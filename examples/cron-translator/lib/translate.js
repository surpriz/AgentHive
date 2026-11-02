import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue';

export const MAX_NEXT = 20;

/**
 * Pure core of the agent: no I/O, so the registry benchmark and the local
 * tests exercise exactly what the endpoint runs.
 *
 * input:  { expression: "0 9 * * 1-5" (5 or 6 cron fields), timezone?: "Europe/Paris", count?: 5, from?: ISO date }
 * output: { expression, description, timezone, next: [ISO…], fields: {...} }
 */
export function translate(input) {
  if (typeof input !== 'object' || input === null) throw new AgentError(400, 'input must be a JSON object');
  const expression = typeof input.expression === 'string' ? input.expression.trim() : '';
  if (!expression) throw new AgentError(400, 'expression is required, e.g. "0 9 * * 1-5"');
  if (expression.length > 120) throw new AgentError(400, 'expression too long');
  const timezone = input.timezone === undefined ? 'UTC' : String(input.timezone);
  const count = input.count === undefined ? 5 : Number(input.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_NEXT) throw new AgentError(400, `count must be an integer between 1 and ${MAX_NEXT}`);
  const from = input.from === undefined ? new Date() : new Date(String(input.from));
  if (Number.isNaN(from.getTime())) throw new AgentError(400, 'from must be an ISO date');

  let iterator;
  try {
    iterator = CronExpressionParser.parse(expression, { currentDate: from, tz: timezone });
  } catch (e) {
    throw new AgentError(422, `invalid cron expression or timezone: ${e.message}`);
  }
  let description;
  try {
    description = cronstrue.toString(expression, { use24HourTimeFormat: true, verbose: true });
  } catch (e) {
    throw new AgentError(422, `cannot describe expression: ${e.message}`);
  }
  const next = [];
  for (let i = 0; i < count; i++) next.push(iterator.next().toISOString());
  const parts = expression.split(/\s+/);
  const names = parts.length === 6 ? ['second', 'minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'] : ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];
  const fields = Object.fromEntries(names.map((n, i) => [n, parts[i] ?? '*']));
  return { expression, description, timezone, next, fields };
}

export class AgentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
