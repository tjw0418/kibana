/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { SavedObjectsRepository } from './lib';

import { SavedObjectsErrorHelpers } from './lib/errors';

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/**
 *
 * @public
 */
export interface SavedObjectsBaseOptions {
  /** Specify the namespace for this operation */
  namespace?: string;
}

/**
 *
 * @public
 */
export interface SavedObjectsCreateOptions extends SavedObjectsBaseOptions {
  /** (not recommended) Specify an id for the document */
  id?: string;
  /** Overwrite existing documents (defaults to false) */
  overwrite?: boolean;
  migrationVersion?: SavedObjectsMigrationVersion;
  references?: SavedObjectReference[];
}

/**
 *
 * @public
 */
export interface SavedObjectsBulkCreateObject<T extends SavedObjectAttributes = any> {
  id?: string;
  type: string;
  attributes: T;
  references?: SavedObjectReference[];
  migrationVersion?: SavedObjectsMigrationVersion;
}

/**
 *
 * @public
 */
export interface SavedObjectsBulkResponse<T extends SavedObjectAttributes = any> {
  saved_objects: Array<SavedObject<T>>;
}

/**
 *
 * @public
 */
export interface SavedObjectsFindOptions extends SavedObjectsBaseOptions {
  type?: string | string[];
  page?: number;
  perPage?: number;
  sortField?: string;
  sortOrder?: string;
  fields?: string[];
  search?: string;
  /** see Elasticsearch Simple Query String Query field argument for more information */
  searchFields?: string[];
  hasReference?: { type: string; id: string };
  defaultSearchOperator?: 'AND' | 'OR';
}

/**
 *
 * @public
 */
export interface SavedObjectsFindResponse<T extends SavedObjectAttributes = any> {
  saved_objects: Array<SavedObject<T>>;
  total: number;
  per_page: number;
  page: number;
}

/**
 *
 * @public
 */
export interface SavedObjectsUpdateOptions extends SavedObjectsBaseOptions {
  /** Ensures version matches that of persisted object */
  version?: string;
  references?: SavedObjectReference[];
}

/**
 *
 * @public
 */
export interface SavedObjectsBulkGetObject {
  id: string;
  type: string;
  /** SavedObject fields to include in the response */
  fields?: string[];
}

/**
 *
 * @public
 */
export interface SavedObjectsBulkResponse<T extends SavedObjectAttributes = any> {
  saved_objects: Array<SavedObject<T>>;
}

/**
 *
 * @public
 */
export interface SavedObjectsUpdateResponse<T extends SavedObjectAttributes = any>
  extends Omit<SavedObject<T>, 'attributes'> {
  attributes: Partial<T>;
}

/**
 * A dictionary of saved object type -> version used to determine
 * what migrations need to be applied to a saved object.
 *
 * @public
 */
export interface SavedObjectsMigrationVersion {
  [pluginName: string]: string;
}

/**
 *
 * @public
 */
export type SavedObjectAttribute =
  | string
  | number
  | boolean
  | null
  | undefined
  | SavedObjectAttributes
  | SavedObjectAttributes[];

/**
 *
 * @public
 */
export interface SavedObjectAttributes {
  [key: string]: SavedObjectAttribute | SavedObjectAttribute[];
}

/**
 *
 * @public
 */
export interface SavedObject<T extends SavedObjectAttributes = any> {
  id: string;
  type: string;
  version?: string;
  updated_at?: string;
  error?: {
    message: string;
    statusCode: number;
  };
  attributes: T;
  references: SavedObjectReference[];
  migrationVersion?: SavedObjectsMigrationVersion;
}

/**
 * A reference to another saved object.
 *
 * @public
 */
export interface SavedObjectReference {
  name: string;
  type: string;
  id: string;
}

/**
 * ## SavedObjectsClient errors
 *
 * Since the SavedObjectsClient has its hands in everything we
 * are a little paranoid about the way we present errors back to
 * to application code. Ideally, all errors will be either:
 *
 *   1. Caused by bad implementation (ie. undefined is not a function) and
 *      as such unpredictable
 *   2. An error that has been classified and decorated appropriately
 *      by the decorators in {@link SavedObjectsErrorHelpers}
 *
 * Type 1 errors are inevitable, but since all expected/handle-able errors
 * should be Type 2 the `isXYZError()` helpers exposed at
 * `SavedObjectsErrorHelpers` should be used to understand and manage error
 * responses from the `SavedObjectsClient`.
 *
 * Type 2 errors are decorated versions of the source error, so if
 * the elasticsearch client threw an error it will be decorated based
 * on its type. That means that rather than looking for `error.body.error.type` or
 * doing substring checks on `error.body.error.reason`, just use the helpers to
 * understand the meaning of the error:
 *
 *   ```js
 *   if (SavedObjectsErrorHelpers.isNotFoundError(error)) {
 *      // handle 404
 *   }
 *
 *   if (SavedObjectsErrorHelpers.isNotAuthorizedError(error)) {
 *      // 401 handling should be automatic, but in case you wanted to know
 *   }
 *
 *   // always rethrow the error unless you handle it
 *   throw error;
 *   ```
 *
 * ### 404s from missing index
 *
 * From the perspective of application code and APIs the SavedObjectsClient is
 * a black box that persists objects. One of the internal details that users have
 * no control over is that we use an elasticsearch index for persistance and that
 * index might be missing.
 *
 * At the time of writing we are in the process of transitioning away from the
 * operating assumption that the SavedObjects index is always available. Part of
 * this transition is handling errors resulting from an index missing. These used
 * to trigger a 500 error in most cases, and in others cause 404s with different
 * error messages.
 *
 * From my (Spencer) perspective, a 404 from the SavedObjectsApi is a 404; The
 * object the request/call was targeting could not be found. This is why #14141
 * takes special care to ensure that 404 errors are generic and don't distinguish
 * between index missing or document missing.
 *
 * ### 503s from missing index
 *
 * Unlike all other methods, create requests are supposed to succeed even when
 * the Kibana index does not exist because it will be automatically created by
 * elasticsearch. When that is not the case it is because Elasticsearch's
 * `action.auto_create_index` setting prevents it from being created automatically
 * so we throw a special 503 with the intention of informing the user that their
 * Elasticsearch settings need to be updated.
 *
 * See {@link SavedObjectsErrorHelpers}
 *
 * @public
 */
export type SavedObjectsClientContract = Pick<SavedObjectsClient, keyof SavedObjectsClient>;

/**
 *
 * @internal
 */
export class SavedObjectsClient {
  public static errors = SavedObjectsErrorHelpers;
  public errors = SavedObjectsErrorHelpers;

  private _repository: SavedObjectsRepository;

  constructor(repository: SavedObjectsRepository) {
    this._repository = repository;
  }

  /**
   * Persists a SavedObject
   *
   * @param type
   * @param attributes
   * @param options
   */
  async create<T extends SavedObjectAttributes = any>(
    type: string,
    attributes: T,
    options?: SavedObjectsCreateOptions
  ) {
    return await this._repository.create(type, attributes, options);
  }

  /**
   * Persists multiple documents batched together as a single request
   *
   * @param objects
   * @param options
   */
  async bulkCreate<T extends SavedObjectAttributes = any>(
    objects: Array<SavedObjectsBulkCreateObject<T>>,
    options?: SavedObjectsCreateOptions
  ) {
    return await this._repository.bulkCreate(objects, options);
  }

  /**
   * Deletes a SavedObject
   *
   * @param type
   * @param id
   * @param options
   */
  async delete(type: string, id: string, options: SavedObjectsBaseOptions = {}) {
    return await this._repository.delete(type, id, options);
  }

  /**
   * Find all SavedObjects matching the search query
   *
   * @param options
   */
  async find<T extends SavedObjectAttributes = any>(
    options: SavedObjectsFindOptions
  ): Promise<SavedObjectsFindResponse<T>> {
    return await this._repository.find(options);
  }

  /**
   * Returns an array of objects by id
   *
   * @param objects - an array of ids, or an array of objects containing id, type and optionally fields
   * @example
   *
   * bulkGet([
   *   { id: 'one', type: 'config' },
   *   { id: 'foo', type: 'index-pattern' }
   * ])
   */
  async bulkGet<T extends SavedObjectAttributes = any>(
    objects: SavedObjectsBulkGetObject[] = [],
    options: SavedObjectsBaseOptions = {}
  ): Promise<SavedObjectsBulkResponse<T>> {
    return await this._repository.bulkGet(objects, options);
  }

  /**
   * Retrieves a single object
   *
   * @param type - The type of SavedObject to retrieve
   * @param id - The ID of the SavedObject to retrieve
   * @param options
   */
  async get<T extends SavedObjectAttributes = any>(
    type: string,
    id: string,
    options: SavedObjectsBaseOptions = {}
  ): Promise<SavedObject<T>> {
    return await this._repository.get(type, id, options);
  }

  /**
   * Updates an SavedObject
   *
   * @param type
   * @param id
   * @param options
   */
  async update<T extends SavedObjectAttributes = any>(
    type: string,
    id: string,
    attributes: Partial<T>,
    options: SavedObjectsUpdateOptions = {}
  ): Promise<SavedObjectsUpdateResponse<T>> {
    return await this._repository.update(type, id, attributes, options);
  }
}
