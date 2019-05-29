import { Owner } from '@ember/-internals/owner';
import { OwnedTemplateMeta } from '@ember/-internals/views';
import { ComponentDefinition, Invocation, WithStaticLayout } from '@glimmer/runtime';
import { Dict } from '@glimmer/util';
import RuntimeResolver from '../resolver';
import { OwnedTemplate } from '../template';
import AbstractComponentManager from './abstract';

export interface InternalComponentClass<T> {
  create(props?: Dict<any>): T;
}

export interface InternalDefinitionState<T> {
  ComponentClass: InternalComponentClass<T>;
  layout: OwnedTemplate;
}

export class InternalComponentDefinition<T, U>
  implements ComponentDefinition<InternalDefinitionState<U>, InternalManager<T, U>> {
  public state: InternalDefinitionState<U>;

  constructor(
    public manager: InternalManager<T, U>,
    ComponentClass: InternalComponentClass<U>,
    layout: OwnedTemplate
  ) {
    this.state = { ComponentClass, layout };
  }
}

export default abstract class InternalManager<T, U>
  extends AbstractComponentManager<T, InternalDefinitionState<U>>
  implements WithStaticLayout<T, InternalDefinitionState<U>, OwnedTemplateMeta, RuntimeResolver> {
  constructor(protected owner: Owner) {
    super();
  }

  getLayout({ layout: _layout }: InternalDefinitionState<U>): Invocation {
    let layout = _layout.asLayout();

    return {
      handle: layout.compile(),
      symbolTable: layout.symbolTable,
    };
  }
}
