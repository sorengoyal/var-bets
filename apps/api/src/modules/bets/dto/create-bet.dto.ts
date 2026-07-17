import { IsString, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBetDto {
  @ApiProperty({ description: 'Pool ID to bet on', example: 1 })
  @IsNumber()
  @IsPositive()
  pool_id!: number;

  @ApiProperty({
    description: 'Bettor Solana wallet address',
    example: 'ATwocoRg4k143WJudXRyUdsk2HCmvwWnLFL2Ajq5vN72',
  })
  @IsString()
  wallet_address!: string;

  @ApiProperty({ description: 'Bet amount in USDC', example: 10 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ description: 'Bet option', example: 'Overturned' })
  @IsString()
  option!: string;
}
