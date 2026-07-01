import { Request, Response, NextFunction } from 'express';
import * as service from './requests.service';
import * as offersService from './offers.service';
import * as reviewsService from '../reviews/reviews.service';
import { RequestStatus } from '@prisma/client';

// POST /api/v1/requests
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const request = await service.createRequest(req.user!.sub, req.body, files);
    res.status(201).json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/requests
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listRequests(
      req.user!.sub,
      req.user!.role as 'CUSTOMER' | 'WORKER',
      {
        status: req.query.status as RequestStatus | undefined,
        page:   Number(req.query.page  ?? 1),
        limit:  Number(req.query.limit ?? 10),
      },
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/requests/:id
export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const request = await service.getRequest(
      req.params.id,
      req.user!.sub,
      req.user!.role,
    );
    res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/requests/:id/rating-eligibility
export async function ratingEligibility(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await reviewsService.getRatingEligibility({ id: req.user!.sub, role: req.user!.role }, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/requests/:id/review
export async function getReview(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await reviewsService.getRequestReview({ id: req.user!.sub, role: req.user!.role }, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/requests/:id/reviews
export async function createReview(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await reviewsService.createRequestReview({ id: req.user!.sub, role: req.user!.role }, req.params.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/requests/:id/status
export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await service.updateStatus(
      req.params.id,
      req.user!.sub,
      req.user!.role as 'CUSTOMER' | 'WORKER',
      req.body.status as RequestStatus,
      req.body.cancellationReason,
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/requests/:id/cancel
export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await service.cancelRequest(
      req.params.id,
      req.user!.sub,
      req.user!.role as 'CUSTOMER' | 'WORKER',
      req.body.reason,
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/requests/:requestId/offers
export async function listOffers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await offersService.listOffers(
      req.params.requestId,
      req.user!.sub,
      req.user!.role as 'CUSTOMER' | 'WORKER' | 'ADMIN',
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/requests/:requestId/offers
export async function createOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await offersService.createOffer(
      req.params.requestId,
      req.user!.sub,
      req.body,
    );
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/requests/:requestId/offers/:offerId/confirm
export async function confirmOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await offersService.confirmOffer(
      req.params.requestId,
      req.params.offerId,
      req.user!.sub,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/requests/:requestId/offers/:offerId/withdraw
export async function withdrawOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await offersService.withdrawOffer(
      req.params.requestId,
      req.params.offerId,
      req.user!.sub,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/requests/:requestId/offers/:offerId/messages
export async function listOfferMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await offersService.listOfferMessages(
      req.params.requestId,
      req.params.offerId,
      req.user!.sub,
      {
        before: req.query.before as string | undefined,
        limit: Number(req.query.limit ?? 50),
      },
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/requests/:requestId/offers/:offerId/messages
export async function sendOfferMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await offersService.sendOfferMessage(
      req.params.requestId,
      req.params.offerId,
      req.user!.sub,
      req.body,
    );
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
