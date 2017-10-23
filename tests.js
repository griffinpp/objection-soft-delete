'use strict';

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

  describe('.delete() or .del()', () => {
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
            expect(result.deleted).to.equal(1, 'row not marked deleted');
          });
      });
    });
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
            expect(result.inactive).to.equal(1, 'row not marked deleted');
          });
      });
    });
    describe('when used with .$query()', () => {
      it('should still mark the row deleted', () => {
        // not sure if this will work...
        const TestObject = getModel({ columnName: 'inactive' });

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).del();
          })
          .then(() => {
            return TestObject.query(knex)
              .where('id', 1)
              .first();
          })
          .then((result) => {
            expect(result.inactive).to.equal(1, 'row not marked deleted');
          })
      });
    });
  });

  describe('.hardDelete()', () => {
    it('should remove the row from the database', () => {
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
    describe('when used with .$query()', () => {
      it('should remove the row from the database', () => {
        const TestObject = getModel({ columnName: 'inactive' });

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex)
              .hardDelete();
          })
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
  });

  describe('.undelete()', () => {
    it('should set the configured delete column to false for any matching records', () => {
      const TestObject = getModel();

      // soft delete the row
      return TestObject.query(knex)
        .where('id', 1)
        .del()
        .then(() => {
          // now undelete the previously deleted row
          return TestObject.query(knex)
            .where('id', 1)
            .undelete();
        })
        .then(() => {
          // and verify
          return TestObject.query(knex)
            .where('id', 1)
            .first();
        })
        .then((result) => {
          expect(result.deleted).to.equal(0, 'row not undeleted');
        });
    });
    describe('when used with .$query()', () => {
      it('should set the configured delete column to false for the matching record', () => {
        const TestObject = getModel();

        // soft delete the row
        return TestObject.query(knex)
          .where('id', 1)
          .del()
          .then(() => {
            // get the deleted row
            return TestObject.query(knex)
              .where('id', 1)
              .first();
          })
          .then((result) => {
            // undelete the row
            return result.$query(knex)
              .undelete();
          })
          .then(() => {
            // and verify
            return TestObject.query(knex)
              .where('id', 1)
              .first();
          })
          .then((result) => {
            expect(result.deleted).to.equal(0, 'row not undeleted');
          });
      });
    });
  });

  describe('.whereNotDeleted()', () => {
    it('should cause deleted rows to be filterd out of the main result set', () => {
      const TestObject = getModel();

      return TestObject.query(knex)
        .where('id', 1)
        .del()
        .then(() => {
          return TestObject.query(knex)
            .whereNotDeleted();
        })
        .then((result) => {
          const anyDeletedExist = result.reduce((acc, obj) => {
            return acc || obj.deleted === 1;
          }, false)
          expect(anyDeletedExist).to.equal(false, 'a deleted record was included in the result set');
        });
    });
    it('should still work when a different columnName was specified', () => {
      const TestObject = getModel({ columnName: 'inactive' });

      return TestObject.query(knex)
        .where('id', 1)
        .del()
        .then(() => {
          return TestObject.query(knex)
            .whereNotDeleted();
        })
        .then((result) => {
          const anyDeletedExist = result.reduce((acc, obj) => {
            return acc || obj.inactive === 1;
          }, false)
          expect(anyDeletedExist).to.equal(false, 'a deleted record was included in the result set');
        });
    });
    it('should work inside a relationship filter', () => {
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
              filter: (f) => {
                f.whereNotDeleted();
              }
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
            .eager('testObjects')
            .first();
        })
        .then((result) => {
          expect(result.testObjects.length).to.equal(1, 'eager returns not filtered properly');
          expect(result.testObjects[0].id).to.equal(2, 'wrong result returned');
        });
    });
  });

  describe('the notDeleted filter', () => {
    it('should exclude any records that have been flagged on the configured column when used in a .eager() function call', () => {
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
        });
    });
  });
});