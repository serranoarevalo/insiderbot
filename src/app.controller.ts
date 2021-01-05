import { Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Timeout } from '@nestjs/schedule';
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

  @Timeout(5000)
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
      if ('date' in lastSeenData.Item) {
        const lastSeen = lastSeenData.Item?.date;
        const response = await got(
          'http://www.openinsider.com/latest-insider-trading',
        );
        const $ = cheerio.load(response.body);
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
            console.log(payload);
          });
        });
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
