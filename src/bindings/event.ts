import { Context } from "probot";
import { processors } from "../handlers/processors";
import { shouldSkip } from "../helpers";
import { BotConfig, Payload, PayloadSchema } from "../types";
import { ajv } from "../utils";
import { loadConfig } from "./config";

let botContext: Context = {} as Context;
export const getBotContext = () => botContext;

let botConfig: BotConfig = {} as BotConfig;
export const getBotConfig = () => botConfig;

const allowedActions = ["labeled", "unlabeled"];

export const bindEvents = async (context: Context): Promise<void> => {
  const { log, id, name } = context;
  botContext = context;
  const payload = context.payload as Payload;

  log.info(`Started binding events... id: ${id}, name: ${name}, action: ${payload.action}}`);
  if (!allowedActions.includes(payload.action)) {
    log.info(`Skipping the event. reason: not configured`);
    return;
  }

  log.info("Loading config from .env...");
  botConfig = await loadConfig();

  const validate = ajv.compile(PayloadSchema);
  const valid = validate(payload);
  if (!valid) {
    log.info("Payload schema validation failed!!!", payload);
    log.warn(validate.errors!);
    return;
  }

  const { skip, reason } = shouldSkip();
  if (skip) {
    log.info(`Skipping the event. reason: ${reason}`);
    return;
  }

  const handlers = processors[payload.action];
  if (!handlers) {
    log.warn(`No handler configured for action: ${payload.action}`);
    return;
  }

  const { pre, action, post } = handlers;
  // Run pre-handlers
  log.info(`Running pre handlers: ${pre.map((fn) => fn.name)}, action: ${payload.action}`);
  for (const preAction of pre) {
    await preAction();
  }
  // Run main handlers
  log.info(`Running main handlers: ${action.map((fn) => fn.name)}, action: ${payload.action}`);
  for (const mainAction of action) {
    await mainAction();
  }

  // Run post-handlers
  log.info(`Running post handlers: ${post.map((fn) => fn.name)}, action: ${payload.action}`);
  for (const postAction of post) {
    await postAction();
  }
};
