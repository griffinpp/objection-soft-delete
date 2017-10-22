const sutFactory = require('./index');
const Model = require('objection').Model;
const Knex = require('knex');
const expect = require('chai').expect;

function getModel(options) {
  const sut = sutFactory(options);

  return class TestObject extends sut(Model) {
    static get tableName() {
      return 'TestObjects';
    }
  };
}

describe('Soft Delete plugin tests', () => {
  let knex;

  before(() => {
    knex = Knex({
      client: 'sqlite3',
      useNullAsDefault: true,
      connection: {
        filename: './test.db'
      }
    });
  });

  before(() => {
    return knex.schema.createTable('TestObjects', (table) => {
      table.increments('id').primary();
      table.string('name');
      table.boolean('deleted');
      table.boolean('inactive');
    })
    .createTable('RelatedObjects', (table) => {
      table.increments('id').primary();
      table.string('name');
    })
    .createTable('JoinTable', (table) => {
      table.increments('id').primary();
      table.integer('testObjectId')
        .unsigned()
        .references('id')
        .inTable('TestObjects');
      table.integer('relatedObjectId')
        .unsigned()
        .references('id')
        .inTable('RelatedObjects');
    });
  });

  after(() => {
    return knex.schema.dropTable('JoinTable')
      .dropTable('TestObjects')
      .dropTable('RelatedObjects');
  });

  after(() => {
    return knex.destroy();
  });

  beforeEach(() => {
    return knex('TestObjects').insert([
      {
        id: 1,
        name: 'Test Object 1',
        deleted: 0,
        inactive: 0,
      },
      {
        id: 2,
        name: 'Test Object 2',
        deleted: 0,
        inactive: 0,
      }
    ])
    .then(() => {
      return knex('RelatedObjects').insert([
        {
          id: 1,
          name: 'RelatedObject 1',
        },
      ]);
    })
    .then(() => {
      return knex('JoinTable').insert([
        {
          testObjectId: 1,
          relatedObjectId: 1,
        },
        {
          testObjectId: 2,
          relatedObjectId: 1,
        }
      ]);
    });
  })

  afterEach(() => {
    return knex('JoinTable').delete()
      .then(() => { return knex('TestObjects').delete(); })
      .then(() => { return knex('RelatedObjects').delete(); });
  })

  describe('when .delete() or .del() is called', () => {
    describe('when a columnName was specified', () => {
      it('should set that columnName to true for any matching records', () => {
        const TestObject = getModel({ columnName: 'inactive' });

        return TestObject.query(knex)
          .where('id', 1)
          .del()
          .then(() => {
            return TestObject.query(knex)
              .where('id', 1)
              .first();
          })
          .then((result) => {
            expect(result.inactive).to.equal(1);
          });
      });
    });
    describe('when a columnName was not specified', () => {
      it('should set the "deleted" column to true for any matching records', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .del()
          .then(() => {
            return TestObject.query(knex)
              .where('id', 1)
              .first();
          })
          .then((result) => {
            expect(result.deleted).to.equal(1);
          });
      });
    });
  });

  describe('when .hardDelete() is called', () => {
    it('should delete the row from the database', () => {
      const TestObject = getModel({ columnName: 'inactive' });

      return TestObject.query(knex)
        .where('id', 1)
        .hardDelete()
        .then(() => {
          return TestObject.query(knex)
            .where('id', 1)
            .first();
        })
        .then((result) => {
          expect(result).to.be.undefined;
        });
    });
  });

  describe('when the notDeleted filter is used in the .eager() function', () => {
    it('should exclude any records that have been flagged on the configured column', () => {
      const TestObject = getModel();

      // define the relationship to the TestObjects table
      const RelatedObject = class RelatedObject extends Model {
        static get tableName() {
          return 'RelatedObjects';
        }

        static get relationMappings() {
          return {
            testObjects: {
              relation: Model.ManyToManyRelation,
              modelClass: TestObject,
              join: {
                from: 'RelatedObjects.id',
                through: {
                  from: 'JoinTable.relatedObjectId',
                  to: 'JoinTable.testObjectId',
                },
                to: 'TestObjects.id',
              },
            },
          }
        }
      };

      return TestObject.query(knex)
        .where('id', 1)
        // soft delete one test object
        .del()
        .then(() => {
          return RelatedObject.query(knex)
            .where('id', 1)
            // use the predefined filter
            .eager('testObjects(notDeleted)')
            .first();
        })
        .then((result) => {
          expect(result.testObjects.length).to.equal(1, 'eager returns not filtered properly');
          expect(result.testObjects[0].id).to.equal(2, 'wrong result returned');
        })
    });
  });
});