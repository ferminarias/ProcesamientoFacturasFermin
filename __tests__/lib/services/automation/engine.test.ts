import { AutomationEngine } from '@/lib/services/automation/engine';

describe('AutomationEngine', () => {
  describe('checkTrigger', () => {
    it('should match DOCUMENT_PROCESSED trigger', async () => {
      const trigger = {
        type: 'DOCUMENT_PROCESSED' as const,
        config: {},
      };

      const event = {
        type: 'document.processed',
        documentId: 'doc-123',
      };

      const result = await AutomationEngine.checkTrigger(trigger, event);
      expect(result).toBe(true);
    });

    it('should match DOCUMENT_TYPE trigger with correct type', async () => {
      const trigger = {
        type: 'DOCUMENT_TYPE' as const,
        config: {
          documentType: 'FACTURA_A',
        },
      };

      const event = {
        type: 'document.processed',
        documentId: 'doc-123',
        documentType: 'FACTURA_A',
      };

      const result = await AutomationEngine.checkTrigger(trigger, event);
      expect(result).toBe(true);
    });

    it('should not match DOCUMENT_TYPE trigger with wrong type', async () => {
      const trigger = {
        type: 'DOCUMENT_TYPE' as const,
        config: {
          documentType: 'FACTURA_A',
        },
      };

      const event = {
        type: 'document.processed',
        documentId: 'doc-123',
        documentType: 'FACTURA_B',
      };

      const result = await AutomationEngine.checkTrigger(trigger, event);
      expect(result).toBe(false);
    });

    it('should not match SCHEDULE trigger in event processing', async () => {
      const trigger = {
        type: 'SCHEDULE' as const,
        config: {
          schedule: '0 0 * * *',
        },
      };

      const event = {
        type: 'document.processed',
        documentId: 'doc-123',
      };

      const result = await AutomationEngine.checkTrigger(trigger, event);
      expect(result).toBe(false);
    });
  });
});
