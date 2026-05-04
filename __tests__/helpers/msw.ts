import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const server = setupServer();

// Re-exports for ergonomics in test files
export { http, HttpResponse };
