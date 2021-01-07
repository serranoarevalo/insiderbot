import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import got from 'got';

@Injectable()
export class AppService {
  client: AWS.DynamoDB.DocumentClient;
  constructor(private readonly configService: ConfigService) {
    AWS.config.update({
      credentials: {
        accessKeyId: this.configService.get('AWS_KEY'),
        secretAccessKey: this.configService.get('AWS_SECRET'),
      },
      region: 'ap-northeast-2',
    });
    this.client = new AWS.DynamoDB.DocumentClient();
  }
  async getChatIds(): Promise<string[] | null> {
    try {
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
          const chatIds = chatIdsData.Item?.ids;
          return chatIds;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  async addChatId(chatId: string): Promise<boolean> {
    try {
      await this.client
        .update({
          TableName: 'insiderBot',
          Key: {
            PartitionKey: 'chatIds',
          },
          UpdateExpression: 'set ids = list_append(ids, :i)',
          ExpressionAttributeValues: {
            ':i': [chatId],
          },
        })
        .promise();
      return true;
    } catch (e) {
      return false;
    }
  }
  async getLastSeen(): Promise<string | null> {
    try {
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
          return lastSeen;
        }
      }
    } catch (e) {
      return null;
    }
  }
  async sendMessage(message: string, chatId: string): Promise<boolean> {
    try {
      await got.post(
        `https://api.telegram.org/${this.configService.get(
          'TELEGRAM_TOKEN',
        )}/sendMessage`,
        {
          json: {
            chat_id: chatId,
            text: message,
            parse_mode: 'markdown',
          },
        },
      );
      return true;
    } catch (e) {
      return false;
    }
  }
  async saveLastSeen(lastSeen: string): Promise<void> {
    try {
      await this.client
        .update({
          TableName: 'insiderBot',
          Key: {
            PartitionKey: 'lastSeen',
          },
          UpdateExpression: 'set lastSeen = :r',
          ExpressionAttributeValues: {
            ':r': lastSeen,
          },
        })
        .promise();
    } catch (e) {}
  }
}
