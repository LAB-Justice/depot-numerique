import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureSwagger(app: INestApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Dépôt Numérique API')
    .setDescription('API de dépôt, analyse, correction et suivi de documents pour Dépôt Numérique.')
    .addTag('system', 'Routes techniques de base de l’API')
    .addTag('health', 'Contrôles de disponibilité et de dépendances')
    .addBearerAuth()
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);
}
