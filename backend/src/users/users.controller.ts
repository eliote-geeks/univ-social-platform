import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':username')
  publicProfile(@Param('username') username: string) {
    return this.users.publicProfile(username);
  }
}
