import { Controller } from "@nestjs/common";
import { EventPattern, MessagePattern, Payload } from "@nestjs/microservices";
import { PostsService } from "./posts/posts.service";
import { CreatePostDto } from "./posts/dto/create-post.dto";

interface GetPostsPayload {
    userId?: string;
    limit?: number;
    offset?: number;
}

interface GetPostPayload {
    postId: string;
}

interface CreatePostPayload extends CreatePostDto {
    authorId: string;
}

@Controller()
export class CommunityController {
    constructor(private readonly postsService: PostsService) {}

    // ═══════════════════════════════════════════════════════════
    // TCP Message Patterns (desde Gateway)
    // ═══════════════════════════════════════════════════════════

    @MessagePattern({ cmd: "get_posts" })
    async getPosts(@Payload() data: GetPostsPayload) {
        return this.postsService.getPosts(data.limit, data.offset);
    }

    @MessagePattern({ cmd: "get_user_posts" })
    async getUserPosts(@Payload() data: GetPostsPayload) {
        if (!data.userId) {
            return { error: "userId is required" };
        }
        return this.postsService.getPostsByUser(data.userId, data.limit);
    }

    @MessagePattern({ cmd: "get_post" })
    async getPost(@Payload() data: GetPostPayload) {
        return this.postsService.getPost(data.postId);
    }

    @MessagePattern({ cmd: "create_post" })
    async createPost(@Payload() data: CreatePostPayload) {
        return this.postsService.createPost(data.authorId, {
            title: data.title,
            content: data.content,
            category: data.category,
        });
    }

    @MessagePattern({ cmd: "delete_user_posts" })
    async deleteUserPosts(@Payload() data: { userId: string }) {
        return this.postsService.deletePostsByUser(data.userId);
    }
}
