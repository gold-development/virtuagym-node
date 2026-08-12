export interface VirtuaGymClientV3Options {
  /** OAuth client id provided by Virtuagym (api@virtuagym.com). */
  readonly clientId: string;
  /** OAuth client secret provided by Virtuagym. */
  readonly clientSecret: string;
  /**
   * The club to act on. Sent as the x-represent-club-id header when
   * requesting a token; each club requires its own token (handled
   * internally).
   */
  readonly clubId: number;
}
