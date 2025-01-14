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

import { EmbeddableApiPure } from './types';
import { Action, ActionContext, buildContextMenuForActions, openContextMenu } from '../lib';

const executeSingleAction = async (action: Action, actionContext: ActionContext) => {
  const href = action.getHref(actionContext);

  // TODO: Do we need a `getHref()` special case?
  if (href) {
    window.location.href = href;
    return;
  }

  await action.execute(actionContext);
};

export const executeTriggerActions: EmbeddableApiPure['executeTriggerActions'] = ({
  api,
}) => async (triggerId, actionContext) => {
  const actions = await api.getTriggerCompatibleActions!(triggerId, {
    embeddable: actionContext.embeddable,
  });

  if (!actions.length) {
    throw new Error(
      `No compatible actions found to execute for trigger [triggerId = ${triggerId}].`
    );
  }

  if (actions.length === 1) {
    await executeSingleAction(actions[0], actionContext);
    return;
  }

  const panel = await buildContextMenuForActions({
    actions,
    actionContext,
    closeMenu: () => session.close(),
  });
  const session = openContextMenu([panel]);
};
