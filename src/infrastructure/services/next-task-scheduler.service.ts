import { after } from "next/server";
import { TaskSchedulerInterface } from "@/application/interfaces/task-scheduler.interface";

/**
 * `TaskSchedulerInterface` on top of Next's `after()`.
 *
 * `after()` hands the callback to the platform, which keeps the invocation
 * alive until it settles instead of freezing it the moment the response is
 * flushed. That is the difference between "the customer's checkout no longer
 * waits for the confirmation email" and "the confirmation email sometimes
 * does not happen", which is what a bare `void promise` actually buys on a
 * serverless host.
 */
export class NextTaskScheduler implements TaskSchedulerInterface {
  runAfterResponse(label: string, task: () => Promise<void>): void {
    const run = () =>
      task().catch((error) => {
        // Nothing is waiting on this by definition, so a rejection has
        // nowhere to go but a log. Swallowing it here also keeps it from
        // becoming an unhandled rejection, which on some runtimes takes the
        // whole process with it.
        console.error(
          `[Deferred] ${label} failed:`,
          error instanceof Error ? error.message : String(error)
        );
      });

    try {
      after(run);
    } catch {
      // `after()` throws when there is no request scope to attach to — a
      // script, a test, or a call made outside a request. There is no
      // response to be after in that case, so running it directly is both
      // safe and the only option. Still detached, because the whole contract
      // of this method is that it does not block its caller.
      void run();
    }
  }
}
