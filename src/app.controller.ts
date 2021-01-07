import { Body, Controller, Post } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AppService } from './app.service';
import * as cheerio from 'cheerio';
import got from 'got';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('/updates')
  async getUpdates(@Body() body) {
    const { message } = body;
    if (message) {
      const { text, chat } = message;
      if (text === '/start') {
        await this.appService.sendMessage(
          'Welcome to Insider Nico Bot💖\nYou are now subscribed to insider trade alerts!',
          chat.id,
        );
        const chatIds = await this.appService.getChatIds();
        if (chatIds !== null) {
          if (!chatIds.includes(chat.id))
            await this.appService.addChatId(chat.id);
        }
      } else {
        await this.appService.sendMessage('Eat 김치! 💖', chat.id);
      }
    }
  }

  @Interval(10000)
  async scrape() {
    const chatIds = await this.appService.getChatIds();
    const lastSeen = await this.appService.getLastSeen();
    const response = await got(
      'http://www.openinsider.com/latest-insider-trading',
    );
    const $ = cheerio.load(response.body);
    let lastStock = 0;
    $('table.tinytable tbody').each((i, item) => {
      $('tr', item).each(async (i, item) => {
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

        if (new Date(fillingDate).getTime() > parseInt(lastSeen)) {
          if (lastStock === 0) {
            lastStock = new Date(fillingDate).getTime();
          }
          chatIds.forEach(async (id) => {
            await this.appService.sendMessage(
              `🚨*Insider Trade Alert*🚨\n\n*Filling Date*: ${payload.fillingDate} \n*Trade Date*: ${payload.tradeDate} \n*Ticker*: ${payload.symbol} \n*Company Name*: ${payload.companyName} \n*Insider Name*: ${payload.insiderName} \n*Title*: ${payload.title} \n*Trade Type*: ${payload.tradeType} \n*Price*: ${payload.price} \n*Qty*: ${payload.qty}\n*Value*: 🤑${payload.value}\n`,
              id,
            );
          });
        }
      });
    });
    if (lastStock !== 0) {
      this.appService.saveLastSeen(lastStock + '');
    }
  }
}
