import { Provider } from '@angular/core';
import { ChatGateway } from './chat-gateway';
import { MockChatGateway } from './mock-chat-gateway';

/**
 * The single switch between chat adapters.
 *
 * Today: the in-memory mock (design preview). When the Firebase adapter is
 * written (`FirebaseChatGateway extends ChatGateway`), bind it here instead —
 * nothing in the store or components changes.
 */
export function provideChatGateway(): Provider[] {
  return [MockChatGateway, { provide: ChatGateway, useExisting: MockChatGateway }];
}
