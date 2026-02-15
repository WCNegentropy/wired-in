import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('content_items')
export class ContentItemEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  platform: string;

  @Column()
  contentType: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  url: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column()
  author: string;

  @Column({ nullable: true })
  authorUrl: string;

  @Column({ nullable: true })
  score: number;

  @Column({ nullable: true })
  commentCount: number;

  @Column()
  publishedAt: string;

  @Column()
  fetchedAt: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
