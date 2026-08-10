import { Money } from '../../../libs/ddd/money.value-object';
import { ArgumentInvalidException } from '../../../libs/exceptions';
import { PaymentRecordedDomainEvent } from './events/payment-recorded.domain-event';
import { PaymentEntity } from './payment.entity';

const ID = '00000000-0000-4000-8000-000000000200';
const RENTAL_ID = '00000000-0000-4000-8000-000000000100';
const NOW = new Date('2026-08-10T03:00:00Z');

test('a recorded movement carries its rental, kind and amount, and announces itself', () => {
  const payment = PaymentEntity.record(
    { rentalId: RENTAL_ID, kind: 'deposit', amount: Money.create(3_000_000), note: null },
    ID,
    NOW,
  );

  expect(payment.rentalId).toBe(RENTAL_ID);
  expect(payment.kind).toBe('deposit');
  expect(payment.amount).toBe(3_000_000);
  expect(payment.domainEvents).toHaveLength(1);
  expect(payment.domainEvents[0]).toBeInstanceOf(PaymentRecordedDomainEvent);
});

test('a 0₫ movement is refused: "not collected" is the absence of a row, not a zero one', () => {
  expect(() =>
    PaymentEntity.record(
      { rentalId: RENTAL_ID, kind: 'deposit', amount: Money.create(0), note: null },
      ID,
      NOW,
    ),
  ).toThrow(ArgumentInvalidException);
});

test('a movement without a rental is impossible', () => {
  expect(() =>
    PaymentEntity.record(
      { rentalId: '', kind: 'rental_fee', amount: Money.create(1_500_000), note: null },
      ID,
      NOW,
    ),
  ).toThrow(ArgumentInvalidException);
});
