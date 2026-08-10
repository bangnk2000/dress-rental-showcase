import { QrLinkRepositoryPort } from '../../application/ports/qr-link.repository.port';
import { QrLinkEntity } from '../../domain/qr-link.entity';
import { CreateUrlCodeCommand } from './create-url-code.command';
import { CreateUrlCodeService } from './create-url-code.service';

function makeRepo(): QrLinkRepositoryPort {
  return {
    insert: jest.fn().mockResolvedValue(undefined), save: jest.fn(), findOneById: jest.fn(),
    nextId: jest.fn().mockReturnValue('00000000-0000-4000-8000-000000000001'),
  };
}

describe('CreateUrlCodeService', () => {
  it('persists an immutable link with the authenticated owner id', async () => {
    const repo = makeRepo();
    const result = await new CreateUrlCodeService(repo).execute(new CreateUrlCodeCommand({
      targetUrl: 'https://example.com/lookbook', label: 'August',
      createdByStaffId: '00000000-0000-4000-8000-000000000002',
    }));
    expect(result.isOk()).toBe(true);
    const inserted = (repo.insert as jest.Mock).mock.calls[0][0] as QrLinkEntity;
    expect(inserted.getProps().targetUrl.unpack()).toBe('https://example.com/lookbook');
    expect(inserted.getProps().createdByStaffId).toBe('00000000-0000-4000-8000-000000000002');
  });
});
