import { Option } from '@glimmer/interfaces';
import { Factory as TemplateFactory } from '../template';

const TEMPLATES: WeakMap<object, TemplateFactory> = new WeakMap();

const getPrototypeOf = Object.getPrototypeOf;

export function setComponentTemplate(factory: TemplateFactory, obj: object) {
  // TODO: throw error if `factory` or obj are undefined
  TEMPLATES.set(obj, factory);
  return obj;
}

export function getComponentTemplate(obj: object): Option<TemplateFactory> {
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
