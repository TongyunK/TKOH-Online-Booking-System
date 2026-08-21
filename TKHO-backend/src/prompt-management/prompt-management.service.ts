import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';

@Injectable()
export class PromptManagementService {
  constructor(private readonly prisma: PrismaService) {}

  private mapPrompt(row: {
    id: bigint;
    prompt_key: string;
    name: string;
    content: string;
    category: string;
    can_add: boolean;
    template_type: string | null;
  }) {
    return {
      id: row.id.toString(),
      key: row.prompt_key,
      name: row.name,
      content: row.content,
      category: row.category,
      canAdd: row.can_add,
      templateType: row.template_type ?? undefined,
    };
  }

  async listPrompts(category?: string) {
    const where =
      category && ['system_fixed', 'reject_template'].includes(category)
        ? { category }
        : {};
    const rows = await this.prisma.prompts.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    return rows.map((r) => this.mapPrompt(r));
  }

  /** 登录页展示 EV / Venue Points to Note（无需 JWT） */
  async listPublicPointsToNote() {
    const keys = ['ev_booking_points_to_note', 'venue_booking_points_to_note'];
    const rows = await this.prisma.prompts.findMany({
      where: {
        category: 'system_fixed',
        prompt_key: { in: keys },
      },
      orderBy: { id: 'asc' },
    });
    return rows.map((r) => this.mapPrompt(r));
  }

  /** EV / Venue 预订页 Important Note 横幅与弹窗（无需 JWT） */
  async listPublicBookingNotices() {
    const keys = ['ev_alert_message', 'venue_alert_message'];
    const rows = await this.prisma.prompts.findMany({
      where: {
        category: 'system_fixed',
        prompt_key: { in: keys },
      },
      orderBy: { id: 'asc' },
    });
    return rows.map((r) => this.mapPrompt(r));
  }

  async createPrompt(dto: CreatePromptDto) {
    const max = await this.prisma.prompts.aggregate({ _max: { id: true } });
    const nextId = (max._max.id ?? BigInt(0)) + BigInt(1);
    const created = await this.prisma.prompts.create({
      data: {
        id: nextId,
        prompt_key: dto.promptKey.trim(),
        name: dto.name.trim(),
        content: dto.content,
        category: dto.category,
        can_add: dto.canAdd !== false,
        template_type: dto.templateType,
      },
    });
    return this.mapPrompt(created);
  }

  async updatePrompt(id: string, dto: UpdatePromptDto) {
    const promptId = BigInt(id);
    const exists = await this.prisma.prompts.findUnique({ where: { id: promptId } });
    if (!exists) throw new NotFoundException('Prompt not found');

    if (exists.category === 'system_fixed') {
      if (dto.content === undefined) {
        return this.mapPrompt(exists);
      }
      if (String(dto.content).trim() === '') {
        throw new BadRequestException('Content cannot be empty');
      }
      const updated = await this.prisma.prompts.update({
        where: { id: promptId },
        data: { content: dto.content },
      });
      return this.mapPrompt(updated);
    }

    if (exists.category !== 'reject_template') {
      throw new BadRequestException('Unsupported prompt category');
    }

    const data: {
      prompt_key?: string;
      name?: string;
      content?: string;
      template_type?: string | null;
      can_add?: boolean;
    } = {};
    if (dto.promptKey !== undefined) data.prompt_key = dto.promptKey.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.templateType !== undefined) data.template_type = dto.templateType;
    if (dto.canAdd !== undefined) data.can_add = dto.canAdd;

    if (Object.keys(data).length === 0) {
      return this.mapPrompt(exists);
    }

    const updated = await this.prisma.prompts.update({
      where: { id: promptId },
      data,
    });
    return this.mapPrompt(updated);
  }

  async deletePrompt(id: string) {
    const promptId = BigInt(id);
    const exists = await this.prisma.prompts.findUnique({ where: { id: promptId } });
    if (!exists) throw new NotFoundException('Prompt not found');
    if (!exists.can_add) {
      throw new BadRequestException('This prompt cannot be deleted');
    }
    await this.prisma.prompts.delete({ where: { id: promptId } });
    return { ok: true };
  }
}
