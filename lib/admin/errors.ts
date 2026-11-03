// Errors the data layer raises. `message` is always a plain sentence that can be
// shown to staff as is; screens never show raw codes.

export type NewsroomErrorCode =
  | "unauthenticated" // no session, or the profile is inactive
  | "forbidden" // the role rules (RLS or a trigger) refused the change
  | "not_found"
  | "invalid" // a constraint or validation failed
  | "conflict"; // a unique value is already taken

export class NewsroomError extends Error {
  constructor(
    readonly code: NewsroomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NewsroomError";
  }
}

export const forbidden = (message = "You don't have permission to do that.") =>
  new NewsroomError("forbidden", message);

export const notFound = (message = "We couldn't find that item. It may have been deleted.") =>
  new NewsroomError("not_found", message);

export const invalid = (message: string) => new NewsroomError("invalid", message);

export const isNewsroomError = (e: unknown): e is NewsroomError => e instanceof NewsroomError;
