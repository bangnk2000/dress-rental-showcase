import { CommandBus } from '@nestjs/cqrs';
import { Err, Ok } from 'oxide.ts';
import { BusinessOutcomeException } from '../../../../libs/exceptions';
import {
  DressUnavailableError,
  RentalDressNotFoundError,
  RentalDressRetiredError,
} from '../../domain/rental.errors';
import { CreateRentalHttpController } from './create-rental.http.controller';
import { CreateRentalRequestDto } from './create-rental.request.dto';

const DRESS_A = '00000000-0000-4000-8000-00000000000a';
const RENTAL_ID = '00000000-0000-4000-8000-0000000000ff';

const body: CreateRentalRequestDto = {
  customerName: 'Nguyễn Thị Hoa',
  customerPhone: '0903123456',
  startDate: '2026-08-01',
  endDate: '2026-08-03',
  items: [{ dressId: DRESS_A }],
} as CreateRentalRequestDto;

function controllerReturning(result: unknown): CreateRentalHttpController {
  const commandBus = { execute: jest.fn().mockResolvedValue(result) } as unknown as CommandBus;
  return new CreateRentalHttpController(commandBus);
}

/**
 * The controller is the seam where a RETURNED domain error becomes an outcome body. Each rejection
 * keeps its own code and payload — collapsing two of them into one code is the bug this guards
 * (ADR 0001 §3).
 */
describe('CreateRentalHttpController', () => {
  it('returns the new id on success', async () => {
    await expect(controllerReturning(Ok(RENTAL_ID)).create(body)).resolves.toEqual({
      id: RENTAL_ID,
    });
  });

  it.each([
    [new RentalDressNotFoundError([DRESS_A]), 'rejected_dress_not_found'],
    [new RentalDressRetiredError([DRESS_A]), 'rejected_dress_retired'],
    [new DressUnavailableError([DRESS_A]), 'rejected_dress_unavailable'],
  ])('renders %s as its own outcome code with dressIds', async (domainError, expectedStatus) => {
    const controller = controllerReturning(Err(domainError));

    const thrown = await controller.create(body).catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(BusinessOutcomeException);
    const outcome = thrown as BusinessOutcomeException;
    expect(outcome.getStatus()).toBe(422);
    expect(outcome.getResponse()).toEqual({ status: expectedStatus, dressIds: [DRESS_A] });
  });

  it('rethrows an unexpected error so the filter renders GENERIC.INTERNAL', async () => {
    const boom = new Error('pool exhausted');

    await expect(controllerReturning(Err(boom)).create(body)).rejects.toBe(boom);
  });
});
