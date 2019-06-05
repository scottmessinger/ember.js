import { EMBER_METAL_TRACKED_PROPERTIES } from '@ember/canary-features';
import {
  Object as EmberObject,
  ArrayProxy,
  ObjectProxy,
  PromiseProxyMixin,
} from '@ember/-internals/runtime';
import { later } from '@ember/runloop';
import { set } from '@ember/-internals/metal';
import { tracked, nativeDescDecorator as descriptor } from '@ember/-internals/metal';
import { Promise } from 'rsvp';
import { moduleFor, RenderingTestCase, strip, runTask } from 'internal-test-helpers';
import GlimmerishComponent from '../../utils/glimmerish-component';
import { Component } from '../../utils/helpers';

if (EMBER_METAL_TRACKED_PROPERTIES) {
  moduleFor(
    'Component Tracked Properties',
    class extends RenderingTestCase {
      '@test simple test using glimmerish component'() {
        let personId = 0;
        class Person {
          @tracked first;
          @tracked last;

          constructor(first, last) {
            this.id = personId++;
            this.first = first;
            this.last = last;
          }
        }

        class PersonComponent extends GlimmerishComponent {
          get person() {
            return new Person(this.args.first, this.args.last);
          }
        }

        this.registerComponent('person-wrapper', {
          ComponentClass: PersonComponent,
          template: '{{@first}} {{@last}} | {{this.person.first}} {{this.person.last}}',
        });

        this.render('<PersonWrapper @first={{first}} @last={{last}} />', {
          first: 'robert',
          last: 'jackson',
        });

        this.assertText('robert jackson | robert jackson');

        runTask(() => this.context.set('first', 'max'));
        this.assertText('max jackson | max jackson');
      }

      '@test returning null and then later a Promise in un-memoized getter does not cause Maximum call stack size exceeded'(
        assert
      ) {
        let ObjectPromiseProxy = ObjectProxy.extend(PromiseProxyMixin);
        let done = assert.async();

        class LoaderComponent extends GlimmerishComponent {
          get data() {
            if (this.args.id === null) {
              return null;
            } else {
              let promise = new Promise((resolve, reject) => {
                resolve(this.args.id);
              });
              return ObjectPromiseProxy.create({ promise: promise });
            }
          }
        }

        this.registerComponent('loader', {
          ComponentClass: LoaderComponent,
          template: '{{this.data.isPending}} {{this.data.isFulfilled}} {{this.data.content}}',
        });

        this.render('<Loader @id={{id}}/>', {
          id: null,
        });

        setTimeout(() => {
          this.context.set('id', 'one');
          done();
        }, 200);

        this.assertText('true false one');
      }

      '@test returning null and then later a Promise in un-memoized getter does not cause perpetual rerenders'(
        assert
      ) {
        let ObjectPromiseProxy = ObjectProxy.extend(PromiseProxyMixin);
        let done = assert.async();

        class LoaderComponent extends GlimmerishComponent {
          async anAsyncFunction(id) {
            let result = await new Promise((resolve, reject) => {
              resolve(this.args.id);
            });
            return result;
          }

          get data() {
            if (this.args.id === null) {
              return null;
            } else {
              return ObjectPromiseProxy.create({ promise: this.anAsyncFunction(this.args.id) });
            }
          }
        }

        this.registerComponent('loader', {
          ComponentClass: LoaderComponent,
          template: '{{this.data.isPending}} {{this.data.isFulfilled}} {{this.data.content}}',
        });

        this.render('<Loader @id={{id}}/>', {
          id: null,
        });

        setTimeout(() => {
          this.context.set('id', 'one');
          done();
        }, 200);

        this.assertText('true false one');
      }

      '@test returning ArrayProxy in un-memoized getter does not cause perpetual rerenders'() {
        let PromiseArray = ArrayProxy.extend(PromiseProxyMixin);

        class LoaderComponent extends GlimmerishComponent {
          get data() {
            return PromiseArray.create({
              promise: Promise.resolve([1, 2, 3]),
            });
          }
        }

        this.registerComponent('loader', {
          ComponentClass: LoaderComponent,
          template: '{{#each this.data as |item|}}{{item}}{{/each}}',
        });

        this.render('<Loader/>');

        this.assertText('123');
      }

      '@test tracked properties that are uninitialized do not throw an error'() {
        let CountComponent = Component.extend({
          count: tracked(),

          increment() {
            if (!this.count) {
              this.count = 0;
            }
            this.count++;
          },
        });

        this.registerComponent('counter', {
          ComponentClass: CountComponent,
          template: '<button {{action this.increment}}>{{this.count}}</button>',
        });

        this.render('<Counter />');

        this.assertText('');

        runTask(() => this.$('button').click());

        this.assertText('1');
      }

      '@test tracked properties rerender when updated'() {
        let CountComponent = Component.extend({
          count: tracked({ value: 0 }),

          increment() {
            this.count++;
          },
        });

        this.registerComponent('counter', {
          ComponentClass: CountComponent,
          template: '<button {{action this.increment}}>{{this.count}}</button>',
        });

        this.render('<Counter />');

        this.assertText('0');

        runTask(() => this.$('button').click());

        this.assertText('1');
      }

      '@test tracked properties rerender when updated outside of a runloop'(assert) {
        let done = assert.async();

        let CountComponent = Component.extend({
          count: tracked({ value: 0 }),

          increment() {
            setTimeout(() => {
              this.count++;
            }, 100);
          },
        });

        this.registerComponent('counter', {
          ComponentClass: CountComponent,
          template: '<button {{action this.increment}}>{{this.count}}</button>',
        });

        this.render('<Counter />');

        this.assertText('0');

        // intentionally outside of a runTask
        this.$('button').click();

        setTimeout(() => {
          this.assertText('1');
          done();
        }, 200);
      }

      '@test nested tracked properties rerender when updated'() {
        let Counter = EmberObject.extend({
          count: tracked({ value: 0 }),
        });

        let CountComponent = Component.extend({
          counter: Counter.create(),

          increment() {
            this.counter.count++;
          },
        });

        this.registerComponent('counter', {
          ComponentClass: CountComponent,
          template: '<button {{action this.increment}}>{{this.counter.count}}</button>',
        });

        this.render('<Counter />');

        this.assertText('0');

        runTask(() => this.$('button').click());

        this.assertText('1');
      }

      '@test getters update when dependent properties are invalidated'() {
        let CountComponent = Component.extend({
          count: tracked({ value: 0 }),

          countAlias: descriptor({
            get() {
              return this.count;
            },
          }),

          increment() {
            this.count++;
          },
        });

        this.registerComponent('counter', {
          ComponentClass: CountComponent,
          template: '<button {{action this.increment}}>{{this.countAlias}}</button>',
        });

        this.render('<Counter />');

        this.assertText('0');

        runTask(() => this.$('button').click());

        this.assertText('1');
      }

      '@test nested getters update when dependent properties are invalidated'() {
        let Counter = EmberObject.extend({
          count: tracked({ value: 0 }),

          countAlias: descriptor({
            get() {
              return this.count;
            },
          }),
        });

        let CountComponent = Component.extend({
          counter: Counter.create(),

          increment() {
            this.counter.count++;
          },
        });

        this.registerComponent('counter', {
          ComponentClass: CountComponent,
          template: '<button {{action this.increment}}>{{this.counter.countAlias}}</button>',
        });

        this.render('<Counter />');

        this.assertText('0');

        runTask(() => this.$('button').click());

        this.assertText('1');
      }

      '@test tracked object passed down through components updates correctly'(assert) {
        let Person = EmberObject.extend({
          first: tracked({ value: 'Rob' }),
          last: tracked({ value: 'Jackson' }),

          full: descriptor({
            get() {
              return `${this.first} ${this.last}`;
            },
          }),
        });

        let ParentComponent = Component.extend({
          person: Person.create(),
        });

        let ChildComponent = Component.extend({
          updatePerson() {
            this.person.first = 'Kris';
            this.person.last = 'Selden';
          },
        });

        this.registerComponent('parent', {
          ComponentClass: ParentComponent,
          template: strip`
            <div id="parent">{{this.person.full}}</div>
            <Child @person={{this.person}}/>
          `,
        });

        this.registerComponent('child', {
          ComponentClass: ChildComponent,
          template: strip`
            <div id="child">{{this.person.full}}</div>
            <button onclick={{action this.updatePerson}}></button>
          `,
        });

        this.render('<Parent />');

        assert.equal(this.$('#parent').text(), 'Rob Jackson');
        assert.equal(this.$('#child').text(), 'Rob Jackson');

        runTask(() => this.$('button').click());

        assert.equal(this.$('#parent').text(), 'Kris Selden');
        assert.equal(this.$('#child').text(), 'Kris Selden');
      }

      '@test yielded getters update correctly'() {
        let PersonComponent = Component.extend({
          first: tracked({ value: 'Rob' }),
          last: tracked({ value: 'Jackson' }),

          full: descriptor({
            get() {
              return `${this.first} ${this.last}`;
            },
          }),

          updatePerson() {
            this.first = 'Kris';
            this.last = 'Selden';
          },
        });

        this.registerComponent('person', {
          ComponentClass: PersonComponent,
          template: strip`
            {{yield this.full (action this.updatePerson)}}
          `,
        });

        this.render(strip`
          <Person as |name update|>
            <button onclick={{update}}>
              {{name}}
            </button>
          </Person>
        `);

        this.assertText('Rob Jackson');

        runTask(() => this.$('button').click());

        this.assertText('Kris Selden');
      }

      '@test yielded nested getters update correctly'() {
        let Person = EmberObject.extend({
          first: tracked({ value: 'Rob' }),
          last: tracked({ value: 'Jackson' }),

          full: descriptor({
            get() {
              return `${this.first} ${this.last}`;
            },
          }),
        });

        let PersonComponent = Component.extend({
          person: Person.create(),

          updatePerson() {
            this.person.first = 'Kris';
            this.person.last = 'Selden';
          },
        });

        this.registerComponent('person', {
          ComponentClass: PersonComponent,
          template: strip`
            {{yield this.person (action this.updatePerson)}}
          `,
        });

        this.render(strip`
          <Person as |p update|>
            <button onclick={{update}}>
              {{p.full}}
            </button>
          </Person>
        `);

        this.assertText('Rob Jackson');

        runTask(() => this.$('button').click());

        this.assertText('Kris Selden');
      }
    }
  );
}
