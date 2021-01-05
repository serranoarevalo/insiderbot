import { Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { AppService } from './app.service';
import * as AWS from 'aws-sdk';

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
      if ('date' in lastSeenData.Item) {
        const lastSeen = lastSeenData.Item?.date;
        console.log(lastSeen);
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
