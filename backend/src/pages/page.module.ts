import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { PostsModule } from '../posts/posts.module';
import { PagesController } from './page.controller';
import { PagesService } from './page.service';

@Module({
  imports: [AuthModule, MediaModule, PostsModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
