import { Context } from "grammy";
import moment from "moment/moment";

import { bot } from "./bot.ts";
import { PollMap, savePollsToFile } from "./pollsStorage.ts";

const MAX_POLL_VOTES = 18;
const MAX_POLL_VOTES_FREE = 24;

const getDate = () => moment().utcOffset(3);

export const createPoll = async (ctx: Context) => {
  if (ctx.chatId && ctx.chat) {
    try {
      const activePoll = PollMap.get(ctx.chatId);

      if (activePoll) {
        if (getDate().isAfter(activePoll.date, "days")) {
          await ctx.api
            .stopPoll(activePoll.chatId, activePoll.messageId)
            .catch(() => null);

          PollMap.delete(ctx.chatId);
        } else {
          return;
        }
      }

      const currentDate = getDate();
      const weekday = currentDate.weekday();
      const isOlderAge = weekday === 1 || weekday === 3 || weekday === 5;
      const description = isOlderAge
        ? `Взрослые (Макс. ${MAX_POLL_VOTES} человек)`
        : `Молодежь (Макс. ${MAX_POLL_VOTES} человек)`;

      const dayOfWeek = currentDate.format("dddd");
      const capitalizedDay =
        dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
      const pollName = `${capitalizedDay} 20:00. ${weekday !== 6 ? description : `(Макс. ${MAX_POLL_VOTES_FREE} человек)`}`;

      const poll = await ctx.replyWithPoll(
        pollName,
        [{ text: "+" }, { text: "-" }],
        {
          is_anonymous: false,
          allows_multiple_answers: false,
        },
      );

      PollMap.set(ctx.chatId, {
        date: getDate().toDate(),
        pollId: poll.poll.id,
        chatId: ctx.chat.id,
        messageId: poll.message_id,
        pollVotes: 0,
        votesFromMessage: 0,
      });
      savePollsToFile();
    } catch (error) {
      console.log("ERROR [createPoll]:", error);
    }
  }
};

const checkStopVote = async (chatId: number, ctx: Context) => {
  try {
    const currentDate = getDate();
    const weekday = currentDate.weekday();

    const activePoll = PollMap.get(chatId);

    if (activePoll) {
      const votes = activePoll.votesFromMessage + activePoll.pollVotes;

      if (votes >= (weekday === 6 ? MAX_POLL_VOTES_FREE : MAX_POLL_VOTES)) {
        await ctx.api.stopPoll(activePoll.chatId, activePoll.messageId);
        await ctx.api
          .sendMessage(
            activePoll.chatId,
            `Опрос завершён! Собралось игроков: ${votes}`,
          )
          .catch(err => {
            console.log("Error [checkStopVote:sendMessage:stopPoll]:", err);
          });

        PollMap.delete(chatId);
        savePollsToFile();
      } else {
        // await ctx.api
        //   .sendMessage(activePoll.chatId, `Всего голосов: ${votes}`)
        //   .catch(err => {
        //     console.log("Error [checkStopVote:sendMessage:totalVotes]:", err);
        //   });
      }
    }
  } catch (err) {
    console.log("Error [checkStopVote]:", err);
  }
};

export const subscribePoll = () => {
  bot.on("poll", async ctx => {
    const chatId = Array.from(PollMap.values()).find(
      poll => poll.pollId === ctx.poll.id,
    )?.chatId;

    if (chatId) {
      const poll = PollMap.get(chatId);

      if (poll) {
        const currentPollVotes =
          ctx.poll.options.find(item => item.text === "+")?.voter_count ?? 0;

        if (currentPollVotes > poll.pollVotes) {
          poll.pollVotes = currentPollVotes;

          savePollsToFile();
          await checkStopVote(poll.chatId, ctx);
        }
      }
    } else {
      console.log(
        `Warn [subscribePoll]: Не найдено активное голосование для pollId = ${ctx.poll.id}`,
      );
    }
  });
};

export const receiveMessageVote = async (ctx: Context) => {
  try {
    const chatId = ctx.chatId;

    if (chatId) {
      const activePoll = PollMap.get(chatId);

      if (activePoll && ctx.message?.text) {
        const message = ctx.message.text;
        const regex = /(?:со\s+мной)\s*[+]?\s*(\d+)/i;
        const match = message.match(regex);

        if (match) {
          const number = parseInt(match[1], 10);
          activePoll.votesFromMessage += number;

          savePollsToFile();
          await checkStopVote(chatId, ctx);
        }
      }
    }
  } catch (error) {
    console.log("ERROR [receiveMessageVote]:", error);
  }
};
