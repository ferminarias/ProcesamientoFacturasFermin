import { prisma } from '@/lib/database/prisma.client';
import { GoogleSheetsExporter } from '@/lib/services/exporters/googleSheets.exporter';
import { ExcelExporter } from '@/lib/services/exporters/excel.exporter';

export interface Trigger {
  type: 'DOCUMENT_PROCESSED' | 'DOCUMENT_TYPE' | 'SCHEDULE';
  config: {
    documentType?: string;
    schedule?: string; // cron expression
  };
}

export interface Action {
  type: 'EXPORT_SHEETS' | 'EXPORT_EXCEL' | 'SEND_EMAIL' | 'WEBHOOK';
  config: {
    spreadsheetId?: string;
    email?: string;
    webhookUrl?: string;
    subject?: string;
    body?: string;
  };
}

export interface Automation {
  id: string;
  name: string;
  trigger: Trigger;
  actions: Action[];
  enabled: boolean;
  tenantId: string;
}

export class AutomationEngine {
  /**
   * Check if a trigger matches an event
   */
  static async checkTrigger(
    trigger: Trigger,
    event: {
      type: string;
      documentId?: string;
      documentType?: string;
    }
  ): Promise<boolean> {
    switch (trigger.type) {
      case 'DOCUMENT_PROCESSED':
        return event.type === 'document.processed';

      case 'DOCUMENT_TYPE':
        return (
          event.type === 'document.processed' &&
          event.documentType === trigger.config.documentType
        );

      case 'SCHEDULE':
        // Schedule triggers are handled by a separate cron job
        return false;

      default:
        return false;
    }
  }

  /**
   * Execute an automation
   */
  static async executeAutomation(
    automationId: string,
    context: {
      documentId?: string;
      tenantId: string;
    }
  ): Promise<void> {
    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
    });

    if (!automation || !automation.enabled) {
      throw new Error('Automation not found or disabled');
    }

    if (automation.tenantId !== context.tenantId) {
      throw new Error('Unauthorized');
    }

    const execution = await prisma.automationExecution.create({
      data: {
        automationId,
        status: 'RUNNING',
        context: context as any,
      },
    });

    try {
      const actions = automation.actions as Action[];

      for (const action of actions) {
        await this.executeAction(action, context);
      }

      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    } catch (error: any) {
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  /**
   * Execute a single action
   */
  private static async executeAction(
    action: Action,
    context: { documentId?: string; tenantId: string }
  ): Promise<void> {
    switch (action.type) {
      case 'EXPORT_SHEETS':
        await this.executeExportSheets(action, context);
        break;

      case 'EXPORT_EXCEL':
        await this.executeExportExcel(action, context);
        break;

      case 'SEND_EMAIL':
        await this.executeSendEmail(action, context);
        break;

      case 'WEBHOOK':
        await this.executeWebhook(action, context);
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Export to Google Sheets
   */
  private static async executeExportSheets(
    action: Action,
    context: { documentId?: string; tenantId: string }
  ): Promise<void> {
    const { spreadsheetId } = action.config;
    if (!spreadsheetId) {
      throw new Error('spreadsheetId is required for EXPORT_SHEETS action');
    }

    // Get integration
    const integration = await prisma.integration.findFirst({
      where: {
        tenantId: context.tenantId,
        provider: 'GOOGLE_SHEETS',
        isActive: true,
      },
    });

    if (!integration || !integration.accessToken) {
      throw new Error('Google Sheets integration not configured');
    }

    // Get document(s)
    const documents = await prisma.document.findMany({
      where: {
        tenantId: context.tenantId,
        id: context.documentId,
        status: 'COMPLETED',
      },
    });

    if (documents.length === 0) {
      throw new Error('No documents found');
    }

    // Export
    const exporter = new GoogleSheetsExporter({
      accessToken: integration.accessToken,
      refreshToken: integration.refreshToken || undefined,
    });

    await exporter.exportDocuments(documents as any, spreadsheetId);
  }

  /**
   * Export to Excel
   */
  private static async executeExportExcel(
    action: Action,
    context: { documentId?: string; tenantId: string }
  ): Promise<void> {
    const documents = await prisma.document.findMany({
      where: {
        tenantId: context.tenantId,
        id: context.documentId,
        status: 'COMPLETED',
      },
    });

    if (documents.length === 0) {
      throw new Error('No documents found');
    }

    const exporter = new ExcelExporter();
    await exporter.exportDocuments(documents as any);

    // Note: In a real implementation, you'd save this file somewhere
    // or attach it to an email
  }

  /**
   * Send email
   */
  private static async executeSendEmail(
    action: Action,
    context: { documentId?: string; tenantId: string }
  ): Promise<void> {
    const { email, subject, body } = action.config;
    if (!email) {
      throw new Error('email is required for SEND_EMAIL action');
    }

    // TODO: Implement email sending with your email provider
    // For now, just log
    console.log('Would send email:', { email, subject, body, context });
  }

  /**
   * Call webhook
   */
  private static async executeWebhook(
    action: Action,
    context: { documentId?: string; tenantId: string }
  ): Promise<void> {
    const { webhookUrl } = action.config;
    if (!webhookUrl) {
      throw new Error('webhookUrl is required for WEBHOOK action');
    }

    const document = context.documentId
      ? await prisma.document.findUnique({
          where: { id: context.documentId },
        })
      : null;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: context.tenantId,
        documentId: context.documentId,
        document,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }
  }

  /**
   * Process triggers for an event
   */
  static async processEvent(event: {
    type: string;
    documentId?: string;
    documentType?: string;
    tenantId: string;
  }): Promise<void> {
    const automations = await prisma.automation.findMany({
      where: {
        tenantId: event.tenantId,
        enabled: true,
      },
    });

    for (const automation of automations) {
      const trigger = automation.trigger as Trigger;

      if (await this.checkTrigger(trigger, event)) {
        // Execute automation in background
        this.executeAutomation(automation.id, {
          documentId: event.documentId,
          tenantId: event.tenantId,
        }).catch((error) => {
          console.error(
            `Failed to execute automation ${automation.id}:`,
            error
          );
        });
      }
    }
  }
}
