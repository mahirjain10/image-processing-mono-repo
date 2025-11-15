import { Controller, Sse, UseGuards, Req, MessageEvent, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthGuard } from '@shared/guards/auth.guard';
import { AuthRequest } from '@shared/interface/AuthRequest.interface';
import { NOTIFICATION_CHANNEL, StatusMessage } from '@shared/interface/status-pub-sub.interface';
import { Observable, fromEvent, filter, map, throwError, catchError, tap } from 'rxjs'; // <-- FIX 1: All operators from 'rxjs'

@Controller('status') // This class now handles the '/status' route
export class StatusController {
  logger = new Logger(StatusController.name)
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @UseGuards(AuthGuard)
  @Sse()
sseStatus(@Req() req: AuthRequest): Observable<MessageEvent> {
  const userId = req.user.id;
  this.logger.debug(`SSE connection established for user: ${userId}`);

  return fromEvent<{ pattern: string; data: StatusMessage }>(this.eventEmitter, NOTIFICATION_CHANNEL).pipe(
    tap((event) => {
      this.logger.debug('Received raw event:', JSON.stringify(event));
    }),
    // Extract the data from the event object
    map(event => event.data || event), // Handle both wrapped and direct messages
    tap((data) => {
      this.logger.debug(`Processing event for user: ${userId}`, JSON.stringify(data));
    }),
    filter((data: StatusMessage) => {
      const matches = data?.userId === userId;
      if (!matches) {
        this.logger.debug(`Event filtered out - ID mismatch: ${data?.userId} !== ${userId}`);
      }
      return matches;
    }),
    map((data: StatusMessage): MessageEvent => {
      this.logger.debug(`Sending SSE data for user: ${userId}`, JSON.stringify(data));
      return { data: JSON.stringify(data) };
    }),
    catchError(err => {
      this.logger.error('SSE Error:', err);
      return throwError(() => err);
    })
  );
}
}