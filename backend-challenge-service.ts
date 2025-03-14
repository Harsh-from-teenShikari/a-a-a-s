// File: backend/src/services/challenges.ts
import { Challenge, ChallengeParticipant } from '../db/models';
import { BlockchainService } from './blockchain';
import { HealthService } from './health';
import { NotFoundError, ForbiddenError } from '../utils/errors';

export class ChallengeService {
  private blockchainService: BlockchainService;
  private healthService: HealthService;

  constructor() {
    this.blockchainService = new BlockchainService();
    this.healthService = new HealthService();
  }

  /**
   * Create a new challenge
   */
  async createChallenge(data: {
    title: string;
    description: string;
    stakingAmount: number;
    goalSteps: number;
    durationDays: number;
    startDate: Date;
    creatorId: string;
    minParticipants?: number;
    isPrivate?: boolean;
  }) {
    // Create challenge in database
    const challenge = await Challenge.create({
      title: data.title,
      description: data.description,
      stakingAmount: data.stakingAmount,
      goalSteps: data.goalSteps,
      durationD