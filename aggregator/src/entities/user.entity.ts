import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'jsonb', nullable: true, default: '[]' })
  subscribedPlatforms: string[];

  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  feedPreferences: Record<string, any>;

  @Column({ type: 'int', default: 20 })
  defaultFeedLimit: number;

  @Column({ default: 'date' })
  defaultSort: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
