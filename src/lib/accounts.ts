import axios from "axios";
import type {
  EmailHeader,
  EmailMessage,
  SyncResponse,
  SyncUpdatedResponse,
} from "./types";

export class Account {
  private token: string;
  constructor(token: string) {
    this.token = token;
  }

  private async startSync(daysWithin: Number): Promise<SyncResponse> {
    const response = axios.post<SyncResponse>(
      `https://api.aurinko.io/v1/email/sync`,
      {},
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        params: {
          daysWithin,
          bodyType: "html",
        },
      },
    );

    return response.data;
  }

  async getUpdatedEmails({
    deltaToken,
    pageToken,
  }: {
    deltaToken: string;
    pageToken: string;
  }) {
    let params: Record<string, string> = {};

    if (deltaToken) params.deltaToken = deltaToken;

    if (pageToken) params.pageToken = pageToken;

    const response = axios.post<SyncResponse>(
      `https://api.aurinko.io/v1/email/sync/updated`,
      {},
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        params,
      },
    );

    return response.data;
  }

  async performInitialSync() {
    try {
      // Start the sync process
      const daysWithin = 3;
      let syncResponse = await this.startSync(daysWithin); // Sync emails from the last 7 days

      // Wait until the sync is ready
      while (!syncResponse.ready) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
        syncResponse = await this.startSync(daysWithin);
      }

      // console.log('Sync is ready. Tokens:', syncResponse);

      // Perform initial sync of updated emails
      let storedDeltaToken: string = syncResponse.syncUpdatedToken;
      let updatedResponse = await this.getUpdatedEmails({
        deltaToken: syncResponse.syncUpdatedToken,
      });
      // console.log('updatedResponse', updatedResponse)
      if (updatedResponse.nextDeltaToken) {
        storedDeltaToken = updatedResponse.nextDeltaToken;
      }
      let allEmails: EmailMessage[] = updatedResponse.records;

      // Fetch all pages if there are more
      while (updatedResponse.nextPageToken) {
        updatedResponse = await this.getUpdatedEmails({
          pageToken: updatedResponse.nextPageToken,
        });
        allEmails = allEmails.concat(updatedResponse.records);
        if (updatedResponse.nextDeltaToken) {
          storedDeltaToken = updatedResponse.nextDeltaToken;
        }
      }

      // console.log('Initial sync complete. Total emails:', allEmails.length);

      // Store the nextDeltaToken for future incremental syncs

      // Example of using the stored delta token for an incremental sync
      // await this.performIncrementalSync(storedDeltaToken);
      return {
        emails: allEmails,
        deltaToken: storedDeltaToken,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          "Error during sync:",
          JSON.stringify(error.response?.data, null, 2),
        );
      } else {
        console.error("Error during sync:", error);
      }
    }
  }
}
