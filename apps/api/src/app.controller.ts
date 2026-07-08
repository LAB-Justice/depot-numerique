import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('system')
@Controller({
  version: '1',
})
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Vérifier que l’API répond',
    description: 'Retourne un message simple permettant de vérifier que l’API est joignable.',
  })
  @ApiOkResponse({
    description: 'L’API répond correctement.',
    type: String,
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
