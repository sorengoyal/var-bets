import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fixtures')
export class Fixture {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamp' })
  Timestamp: Date;

  @Column({ type: 'timestamp' })
  StartTime: Date;

  @Column()
  Competition: string;

  @Column()
  CompetitionId: string;

  @Column()
  FixtureGroupId: string;

  @Column()
  Participant1Id: string;

  @Column()
  Participant1: string;

  @Column()
  Participant2Id: string;

  @Column()
  Participant2: string;

  @Column()
  FixtureId: string;

  @Column()
  Participant1IsHome: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('fixtures_metadata')
export class FixtureMetadata {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fixture_id: number;

  @Column()
  active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('pools')
export class Pool {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fixture_id: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: number;

  @Column({ default: true })
  acceptingBets: boolean;

  @Column({ default: false })
  paidOut: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('bets')
export class Bet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  pool_id: number;

  @Column()
  wallet_address: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column()
  option: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('payouts')
export class Payout {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  poolId: number;

  @Column()
  wallet_address: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('scores')
export class Score {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fixtureId: number;

  @Column()
  Action: string;

  @Column({ type: 'jsonb' })
  Data: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string; // UUIDv7 handled by app logic or DB

  @Column({ type: 'jsonb' })
  config: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
