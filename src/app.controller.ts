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
    const data = await this.client
      .get({
        TableName: 'insiderBot',
        Key: {
          PartitionKey: 'chatIds',
        },
      })
      .promise();
    const chatIds = data.Item?.ids.values;
    return;
  }
}
