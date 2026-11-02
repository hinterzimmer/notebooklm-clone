import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../../aws/bedrock.service.js';

@Injectable()
export class GuardrailsService {
  private readonly logger = new Logger(GuardrailsService.name);

  constructor(private readonly bedrockService: BedrockService) {}

  async validateInput(text: string): Promise<{ allowed: boolean; reason?: string }> {
    const res = await this.bedrockService.applyGuardrail(text, 'INPUT');
    if (res.action === 'GUARDRAIL_INTERVENED') {
      return {
        allowed: false,
        reason: res.outputs?.[0] || 'Content blocked by Bedrock Guardrails (policy violation)',
      };
    }
    return { allowed: true };
  }

  async validateOutput(text: string): Promise<{ allowed: boolean; reason?: string }> {
    const res = await this.bedrockService.applyGuardrail(text, 'OUTPUT');
    if (res.action === 'GUARDRAIL_INTERVENED') {
      return {
        allowed: false,
        reason: res.outputs?.[0] || 'Response blocked by Bedrock Guardrails (grounding/PII violation)',
      };
    }
    return { allowed: true };
  }
}
