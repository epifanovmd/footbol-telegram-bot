import { Context } from "grammy";
import moment from "moment/moment";

import { bot } from "./bot.ts";

export let activePoll: {
  date: Date;
  pollId: string;
  chatId: number;
  messageId: number;
  pollVotes: number;
  votesFromMessage: number;
} | null = null;

const getDate = () => moment().utcOffset(3);

export const createPoll = async (ctx: Context) => {
  if (activePoll) {
    if (getDate().isAfter(activePoll.date, "days")) {
      await ctx.api.stopPoll(activePoll.chatId, activePoll.messageId);

      activePoll = null;
    } else {
      return;
    }
  }

  const currentDate = getDate();
  const weekday = currentDate.weekday();
  const isLimitedDay = weekday === 1 || weekday === 3 || weekday === 5;

  const dayOfWeek = currentDate.format("dddd");
  const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
  const pollName = `${capitalizedDay} 20:00 ${isLimitedDay ? "(Макс. 18 человек)" : ""}`;

  const poll = await ctx.replyWithPoll(
    pollName,
    [{ text: "+" }, { text: "-" }],
    {
      is_anonymous: false,
      allows_multiple_answers: false,
    },
  );

  if (ctx.chat) {
    activePoll = {
      date: getDate().toDate(),
      pollId: poll.poll.id,
      chatId: ctx.chat.id,
      messageId: poll.message_id,
      pollVotes: 0,
      votesFromMessage: 0,
    };
  }
};

const checkStopVote = async (ctx: Context) => {
  const currentDate = getDate();
  const weekday = currentDate.weekday();
  const isLimitedDay = weekday === 1 || weekday === 3 || weekday === 5;

  if (activePoll && isLimitedDay) {
    const votes = activePoll.votesFromMessage + activePoll.pollVotes;

    if (votes >= 18) {
      try {
        await ctx.api.stopPoll(activePoll.chatId, activePoll.messageId);
        await ctx.api.sendMessage(
          activePoll.chatId,
          `Опрос завершён! Голосов: ${votes}`,
        );
        activePoll = null;
      } catch (err) {
        console.log("Error [checkStopVote]:", err);
      }
    }
  }
};

export const subscribePoll = () => {
  bot.on("poll", async ctx => {
    const poll = ctx.poll;

    if (activePoll && activePoll.pollId === poll.id) {
      activePoll.pollVotes =
        poll.options.find(item => item.text === "+")?.voter_count ?? 0;

      await checkStopVote(ctx);
    }
  });
};

export const receiveMessageVote = async (ctx: Context) => {
  if (activePoll && ctx.message?.text) {
    const message = ctx.message.text;
    const regex = /(?:со\s+мной)\s*[+]?\s*(\d+)/i;
    const match = message.match(regex);

    if (match) {
      const number = parseInt(match[1], 10);
      activePoll.votesFromMessage += number;

      await checkStopVote(ctx);
    }
  }
};
