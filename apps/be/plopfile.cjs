/**
 * Deterministic vertical-slice scaffolds (08-ai-agent-first).
 *   pnpm --filter be plop slice -- --context catalog --name retire-dress
 *   pnpm --filter be plop query -- --context rentals --name today-board
 * Fill the TODO bodies afterwards; the shape matches the create-dress reference slice.
 */
const COMMAND_FILES = {
  '{{name}}.command.ts': `import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class {{pascal name}}Command extends Command {
  // TODO: readonly fields carried by this command (primitives only)

  constructor(props: CommandProps<{{pascal name}}Command>) {
    super(props);
    // TODO: assign fields
  }
}
`,
  '{{name}}.service.ts': `import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result } from 'oxide.ts';
import { {{pascal name}}Command } from './{{name}}.command';

export type {{pascal name}}Result = Result<string, Error>; // TODO: narrow Success/DomainError

@CommandHandler({{pascal name}}Command)
export class {{pascal name}}Service implements ICommandHandler<{{pascal name}}Command, {{pascal name}}Result> {
  // TODO: @Inject repository port(s)

  async execute(command: {{pascal name}}Command): Promise<{{pascal name}}Result> {
    throw new Error('TODO: orchestrate domain + repository port, return Ok/Err');
  }
}
`,
  '{{name}}.request.dto.ts': `import { ApiProperty } from '@nestjs/swagger';

export class {{pascal name}}RequestDto {
  // TODO: class-validator fields with @ApiProperty
}
`,
  '{{name}}.http.controller.ts': `import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { match } from 'oxide.ts';
import { IdResponse } from '../../../../libs/ddd/id.response.dto';
import { {{pascal name}}Command } from './{{name}}.command';
import { {{pascal name}}RequestDto } from './{{name}}.request.dto';
import { {{pascal name}}Result } from './{{name}}.service';

@ApiTags('{{context}}')
@ApiBearerAuth()
@Controller({ path: '{{context}}', version: '1' })
export class {{pascal name}}HttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({ summary: 'TODO' })
  @ApiCreatedResponse({ type: IdResponse })
  async handle(@Body() body: {{pascal name}}RequestDto): Promise<IdResponse> {
    const result: {{pascal name}}Result = await this.commandBus.execute(
      new {{pascal name}}Command({ ...body }),
    );
    return match(result, {
      Ok: (id) => new IdResponse(id),
      Err: (error: Error) => {
        // TODO: map domain errors to libs/exceptions types (409/404/400)
        throw error;
      },
    });
  }
}
`,
  '{{name}}.service.spec.ts': `import { {{pascal name}}Service } from './{{name}}.service';

describe('{{pascal name}}Service', () => {
  it.todo('returns Ok on the happy path');
  it.todo('returns Err on each documented domain error');
});
`,
};

const QUERY_FILES = {
  '{{name}}.query.ts': `import { QueryBase } from '../../../../libs/ddd/query.base';

export class {{pascal name}}Query extends QueryBase {
  // TODO: filter fields
}
`,
  '{{name}}.query-handler.ts': `import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool } from 'slonik';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import { {{pascal name}}Query } from './{{name}}.query';
import { {{pascal name}}ResponseDto } from './{{name}}.response.dto';

@QueryHandler({{pascal name}}Query)
export class {{pascal name}}QueryHandler implements IQueryHandler<{{pascal name}}Query, {{pascal name}}ResponseDto> {
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  async execute(query: {{pascal name}}Query): Promise<{{pascal name}}ResponseDto> {
    throw new Error('TODO: read side — straight SQL, project to the response DTO');
  }
}
`,
  '{{name}}.response.dto.ts': `import { ApiProperty } from '@nestjs/swagger';

export class {{pascal name}}ResponseDto {
  // TODO: @ApiProperty fields (expose ONLY intended data)
}
`,
  '{{name}}.http.controller.ts': `import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { {{pascal name}}Query } from './{{name}}.query';
import { {{pascal name}}ResponseDto } from './{{name}}.response.dto';

@ApiTags('{{context}}')
@ApiBearerAuth()
@Controller({ path: '{{context}}', version: '1' })
export class {{pascal name}}HttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'TODO' })
  @ApiOkResponse({ type: {{pascal name}}ResponseDto })
  async handle(): Promise<{{pascal name}}ResponseDto> {
    return this.queryBus.execute(new {{pascal name}}Query());
  }
}
`,
};

function actionsFor(kind, files) {
  return Object.entries(files).map(([file, template]) => ({
    type: 'add',
    path: `src/modules/{{context}}/${kind}/{{name}}/${file}`,
    template,
  }));
}

module.exports = function (plop) {
  plop.setHelper('pascal', (t) =>
    t
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(''),
  );

  plop.setGenerator('slice', {
    description: 'Write slice: command + service + controller + DTO + spec',
    prompts: [
      { type: 'input', name: 'context', message: 'bounded context (e.g. catalog)' },
      { type: 'input', name: 'name', message: 'use case, kebab-case (e.g. retire-dress)' },
    ],
    actions: actionsFor('commands', COMMAND_FILES),
  });

  plop.setGenerator('query', {
    description: 'Read slice: query + handler + response DTO + controller',
    prompts: [
      { type: 'input', name: 'context', message: 'bounded context (e.g. rentals)' },
      { type: 'input', name: 'name', message: 'query, kebab-case (e.g. today-board)' },
    ],
    actions: actionsFor('queries', QUERY_FILES),
  });
};
