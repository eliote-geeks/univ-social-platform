import { Controller, Get, Param } from '@nestjs/common';
import { UniversitiesService } from './universities.service';

@Controller('universities')
export class UniversitiesController {
  constructor(private readonly universities: UniversitiesService) {}

  @Get()
  list() {
    return this.universities.list();
  }

  @Get(':slug')
  find(@Param('slug') slug: string) {
    return this.universities.find(slug);
  }
}
