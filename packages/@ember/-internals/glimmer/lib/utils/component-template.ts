import { toString } from '@ember/-internals/utils';
import { assert } from '@ember/debug';
import { Option } from '@glimmer/interfaces';
import { Factory as TemplateFactory, NewTemplateFactory } from '../template';

const TEMPLATES: WeakMap<object, NewTemplateFactory> = new WeakMap();

const getPrototypeOf = Object.getPrototypeOf;

function isTemplateFactory(
  factory: TemplateFactory | NewTemplateFactory
): factory is TemplateFactory {
  return typeof factory['toNewTemplateFactory'] === 'function';
}

export function setComponentTemplate(_factory: TemplateFactory | NewTemplateFactory, obj: object) {
  assert(
    `Cannot call \`setComponentTemplate\` on \`${toString(obj)}\``,
    obj !== null && (typeof obj === 'object' || typeof obj === 'function')
  );

  assert(
    `Cannot call \`setComponentTemplate\` multiple times on the same class (\`${obj}\`)`,
    !TEMPLATES.has(obj)
  );

  let factory = isTemplateFactory(_factory) ? _factory.toNewTemplateFactory() : _factory;

  TEMPLATES.set(obj, factory);

  return obj;
}

export function getComponentTemplate(obj: object): Option<NewTemplateFactory> {
  let pointer = obj;
  while (pointer !== undefined && pointer !== null) {
    let template = TEMPLATES.get(pointer);

    if (template !== undefined) {
      return template;
    }

    pointer = getPrototypeOf(pointer);
  }

  return null;
}
