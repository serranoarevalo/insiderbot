import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { AppService } from './app.service';
import * as AWS from 'aws-sdk';
import got from 'got';
import * as cheerio from 'cheerio';

@Controller()
export class AppController {
  client: AWS.DynamoDB.DocumentClient;
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {
    AWS.config.update({
      credentials: {
        accessKeyId: this.configService.get('AWS_KEY'),
        secretAccessKey: this.configService.get('AWS_SECRET'),
      },
      region: 'ap-northeast-2',
    });
    this.client = new AWS.DynamoDB.DocumentClient();
  }

  @Post('/updates')
  async getUpdates(@Body() body) {
    const { message } = body;
    if (message) {
      const { text, chat } = message;
      console.log(chat);
      if (text === '/start') {
        await got.post(
          `https://api.telegram.org/${this.configService.get(
            'TELEGRAM_TOKEN',
          )}/sendMessage`,
          {
            json: {
              chat_id: chat.id,
              text:
                'Welcome to Insider Nico Bot💖\nYou are now subscribed to insider trade alerts!',
            },
          },
        );
        await this.client
          .update({
            TableName: 'insiderBot',
            Key: {
              PartitionKey: 'chatIds',
            },
            UpdateExpression: 'set ids = list_append(ids, :i)',
            ExpressionAttributeValues: {
              ':i': [chat.id],
            },
          })
          .promise();
      }
    }
  }

  @Interval(5000)
  async scrape() {
    const lastSeenData = await this.client
      .get({
        TableName: 'insiderBot',
        Key: {
          PartitionKey: 'lastSeen',
        },
      })
      .promise();
    if (lastSeenData.Item) {
      if ('lastSeen' in lastSeenData.Item) {
        const lastSeen = lastSeenData.Item?.lastSeen;
        const response = await got(
          'http://www.openinsider.com/latest-insider-trading',
        );
        const $ = cheerio.load(response.body);
        let lastStock = 0;
        $('table.tinytable tbody').each((i, item) => {
          $('tr', item).each((i, item) => {
            let trade = '';
            $('td', item).each((i, item) => {
              trade += `${$(item).text().trim()}|`;
            });
            const [
              X,
              fillingDate,
              tradeDate,
              ticker,
              companyName,
              insiderName,
              title,
              tradeType,
              price,
              qty,
              owned,
              ownUp,
              value,
              day,
              week,
              month,
              sixMonths,
            ] = trade.split('|');
            const payload = {
              fillingDate,
              tradeDate,
              symbol: ticker,
              companyName,
              insiderName,
              title,
              tradeType,
              price,
              qty: qty.replace('-', ''),
              value: value.replace('-', ''),
            };

            if (new Date(fillingDate).getTime() > lastSeen) {
              console.log(payload);
              if (lastStock === 0) {
                lastStock = new Date(fillingDate).getTime();
              }
            }
          });
        });
        if (lastStock !== 0) {
          await this.client
            .update({
              TableName: 'insiderBot',
              Key: {
                PartitionKey: 'lastSeen',
              },
              UpdateExpression: 'set lastSeen = :r',
              ExpressionAttributeValues: {
                ':r': lastStock,
              },
            })
            .promise();
        } else {
          console.log('====== NOTHING TO REPORT ======');
        }
      }
    }
    const chatIdsData = await this.client
      .get({
        TableName: 'insiderBot',
        Key: {
          PartitionKey: 'chatIds',
        },
      })
      .promise();
    if (chatIdsData.Item) {
      if ('ids' in chatIdsData.Item) {
        const chatIds = chatIdsData.Item?.ids.values;
        console.log(chatIds);
      }
    }
    return;
  }
}
