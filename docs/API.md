# API Overview

Base path: `/api/v1`. Protected endpoints require `Authorization: Bearer <access-token>`.

| Domain | Representative endpoints | Access |
| --- | --- | --- |
| Auth | `POST /auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password` | Public except logout |
| Users | `GET/PUT /users/profile`, `PUT /users/change-password`, `GET /users/history` | Authenticated owner |
| Workers | `GET /workers`, `GET /workers/:id`, profile/category/availability updates | Public profile or worker owner, depending on route |
| Categories | `GET /categories` | Public |
| Requests | `POST/GET /requests`, `GET /requests/:id`, status/cancel routes | Customer/worker role and ownership rules |
| Offers | list/create/confirm/withdraw under `/requests/:requestId/offers` | Request owner or eligible offer worker |
| Offer chat | offer message routes under an offer | Request owner and that offer's worker only |
| Assigned chat | `/messages/:requestId` | Request owner and assigned worker only |
| Reviews | request review and worker review routes | Completed-request owner or public aggregate |
| Subscriptions | `/subscriptions/me`, RevenueCat verification and webhook | Worker owner; authenticated webhook |
| Notifications | list, unread count, mark read | Authenticated owner |
| Payments | request-scoped payment endpoints | Request participant; online flow fails closed until provider exists |
| Admin | users, workers, requests, categories, analytics | `ADMIN` only |

Validation failures return a stable error envelope. Server errors do not return provider, Prisma, stack, or secret details. Responses include a request ID for support correlation.

## Socket.IO Events

- Client: `chat:join`, `chat:leave`, `chat:message`, `chat:typing`, `chat:stop-typing`
- Server: `chat:joined`, `chat:left`, `chat:message`, `chat:error`, notification and request/offer lifecycle events

Socket authentication uses `auth.token` or a Bearer header. Room joins are authorized against the database. Messages are limited to 2,000 characters, chat sends are rate limited, and every packet rechecks session validity.
