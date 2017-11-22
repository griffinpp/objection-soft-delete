'use strict' // eslint-disable-line

const sutFactory = require('./index');
// eslint-disable-next-line
const Model = require('objection').Model;
// eslint-disable-next-line
const Knex = require('knex');
// eslint-disable-next-line
const expect = require('chai').expect;

let buCalled;
let bdCalled;
let auCalled;
let adCalled;
let bsdCalled;
let asdCalled;
let bhdCalled;
let ahdCalled;
let budCalled;
let audCalled;

function getModel(options) {
  const sut = sutFactory(options);

  buCalled = false;
  bdCalled = false;
  auCalled = false;
  adCalled = false;
  bsdCalled = false;
  asdCalled = false;
  bhdCalled = false;
  ahdCalled = false;
  budCalled = false;
  audCalled = false;

  return class TestObject extends sut(Model) {
    // eslint-disable-next-line
    $beforeUpdate() {
      buCalled = true;
    }
    // eslint-disable-next-line
    $beforeDelete() {
      bdCalled = true;
    }
    // eslint-disable-next-line
    $beforeSoftDelete() {
      bsdCalled = true;
    }
    // eslint-disable-next-line
    $beforeHardDelete() {
      bhdCalled = true;
    }
    // eslint-disable-next-line
    $beforeUndelete() {
      budCalled = true;
    }
    // eslint-disable-next-line
    $afterUpdate() {
      auCalled = true;
    }
    // eslint-disable-next-line
    $afterDelete() {
      adCalled = true;
    }
    // eslint-disable-next-line
    $afterSoftDelete() {
      asdCalled = true;
    }
    // eslint-disable-next-line
    $afterHardDelete() {
      ahdCalled = true;
    }
    // eslint-disable-next-line
    $afterUndelete() {
      audCalled = true;
    }

    static get tableName() {
      return 'TestObjects';
    }

    static get jsonSchema() {
      return {
        type: 'object',
        required: [],

        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          deleted: { type: 'boolean' },
          inactive: { type: 'boolean' },
        },
      };
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
        filename: './test.db',
      },
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
        table.boolean('deleted');
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
      },
    ])
      .then(() => {
        return knex('RelatedObjects').insert([
          {
            id: 1,
            name: 'RelatedObject 1',
            deleted: 0,
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
          },
        ]);
      });
  });

  afterEach(() => {
    return knex('JoinTable').delete()
      .then(() => { return knex('TestObjects').delete(); })
      .then(() => { return knex('RelatedObjects').delete(); });
  });

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
          });
      });
      it('should call the .$beforeSoftDelete function, if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).del();
          })
          .then(() => {
            expect(bsdCalled).to.equal(true, '$beforeSoftDelete not called');
          });
      });
      it('should call the .$beforeDelete function, if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).del();
          })
          .then(() => {
            expect(bdCalled).to.equal(true, '$beforeDelete not called');
          });
      });
      it('should not call the .$beforeHardDelete function, even if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).del();
          })
          .then(() => {
            expect(bhdCalled).to.equal(false, '$beforeHardDelete called');
          });
      });
      it('should not call the .$beforeUpdate function, even if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).del();
          })
          .then(() => {
            expect(buCalled).to.equal(false, '$beforeUpdate called');
          });
      });
      it('should call the .$afterSoftDelete function, if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).del();
          })
          .then(() => {
            expect(asdCalled).to.equal(true, '$afterSoftDelete not called');
          });
      });
      it('should call the .$afterDelete function, if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).del();
          })
          .then(() => {
            expect(adCalled).to.equal(true, '$afterDelete not called');
          });
      });
      it('should not call the .$afterHardDelete function, even if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).del();
          })
          .then(() => {
            expect(ahdCalled).to.equal(false, '$afterHardDelete called');
          });
      });
      it('should not call the .$afterUpdate function, even if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).del();
          })
          .then(() => {
            expect(auCalled).to.equal(false, '$afterUpdate called');
          });
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
          // eslint-disable-next-line
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
            // eslint-disable-next-line
            expect(result).to.be.undefined;
          });
      });
      it('should not call the .$beforeSoftDelete function, even if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).hardDelete();
          })
          .then(() => {
            expect(bsdCalled).to.equal(false, '$beforeSoftDelete called');
          });
      });
      it('should call the .$beforeDelete function, if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).hardDelete();
          })
          .then(() => {
            expect(bdCalled).to.equal(true, '$beforeDelete not called');
          });
      });
      it('should call the .$beforeHardDelete function, if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).hardDelete();
          })
          .then(() => {
            expect(bhdCalled).to.equal(true, '$beforeHardDelete not called');
          });
      });
      it('should not call the .$beforeUpdate function, even if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).hardDelete();
          })
          .then(() => {
            expect(buCalled).to.equal(false, '$beforeUpdate called');
          });
      });
      it('should not call the .$afterSoftDelete function, even if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).hardDelete();
          })
          .then(() => {
            expect(asdCalled).to.equal(false, '$afterSoftDelete called');
          });
      });
      it('should call the .$afterDelete function, if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).hardDelete();
          })
          .then(() => {
            expect(adCalled).to.equal(true, '$afterDelete not called');
          });
      });
      it('should call the .$afterHardDelete function, if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).hardDelete();
          })
          .then(() => {
            expect(ahdCalled).to.equal(true, '$afterHardDelete not called');
          });
      });
      it('should not call the .$afterUpdate function, even if there is one', () => {
        const TestObject = getModel();

        return TestObject.query(knex)
          .where('id', 1)
          .first()
          .then((result) => {
            return result.$query(knex).hardDelete();
          })
          .then(() => {
            expect(auCalled).to.equal(false, '$afterUpdate called');
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
      it('should call the $beforeUndelete function, if it exists', () => {
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
            expect(budCalled).to.equal(true, '$beforeUndelete not called');
          });
      });
      it('should call the $afterUndelete function, if it exists', () => {
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
            expect(audCalled).to.equal(true, '$afterUndelete not called');
          });
      });
      it('should not call the $beforeUpdate funciton, if it exists', () => {
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
            expect(buCalled).to.equal(false, '$beforeUpdate called');
          });
      });
      it('should not call the $afterUpdate function, if it exists', () => {
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
            expect(auCalled).to.equal(false, '$afterUpdate called');
          });
      });
    });
  });

  describe('$query.patch() or $query.update()', () => {
    it('should call the $beforeUpdate function, if it exists', () => {
      const TestObject = getModel();

      // soft delete the row
      return TestObject.query(knex)
        .where('id', 1)
        .first()
        .then((result) => {
          // undelete the row
          return result.$query(knex)
            .patch({ name: 'update' });
        })
        .then(() => {
          expect(buCalled).to.equal(true, '$beforeUpdate not called');
        });
    });
    it('should call the $afterUpdate function, if it exists', () => {
      const TestObject = getModel();

      // soft delete the row
      return TestObject.query(knex)
        .where('id', 1)
        .first()
        .then((result) => {
          // undelete the row
          return result.$query(knex)
            .patch({ name: 'update' });
        })
        .then(() => {
          expect(auCalled).to.equal(true, '$afterUpdate not called');
        });
    });
    it('should not call any of the new life cycle functions, even if they exist', () => {
      const TestObject = getModel();

      // soft delete the row
      return TestObject.query(knex)
        .where('id', 1)
        .first()
        .then((result) => {
          // undelete the row
          return result.$query(knex)
            .patch({ name: 'update' });
        })
        .then(() => {
          expect(bsdCalled).to.equal(false, '$beforeSoftDelete called');
          expect(asdCalled).to.equal(false, '$afterSoftDelete called');
          expect(bhdCalled).to.equal(false, '$beforeHardDelete called');
          expect(ahdCalled).to.equal(false, '$afterHardDelete called');
          expect(budCalled).to.equal(false, '$beforeUndelete called');
          expect(audCalled).to.equal(false, '$afterUndelete called');
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
          }, false);
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
          }, false);
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
              },
            },
          };
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

  describe('.whereDeleted()', () => {
    it('should cause only deleted rows to appear in the result set', () => {
      const TestObject = getModel();

      return TestObject.query(knex)
        .where('id', 1)
        .del()
        .then(() => {
          return TestObject.query(knex)
            .whereDeleted();
        })
        .then((result) => {
          const allDeleted = result.reduce((acc, obj) => {
            return acc && obj.deleted === 1;
          }, true);
          expect(allDeleted).to.equal(true, 'an undeleted record was included in the result set');
        });
    });
    it('should still work when a different columnName was specified', () => {
      const TestObject = getModel({ columnName: 'inactive' });

      return TestObject.query(knex)
        .where('id', 1)
        .del()
        .then(() => {
          return TestObject.query(knex)
            .whereDeleted();
        })
        .then((result) => {
          const allDeleted = result.reduce((acc, obj) => {
            return acc && obj.inactive === 1;
          }, true);
          expect(allDeleted).to.equal(true, 'an undeleted record was included in the result set');
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
                f.whereDeleted();
              },
            },
          };
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
          expect(result.testObjects[0].id).to.equal(1, 'wrong result returned');
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
          };
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
  describe('the deleted filter', () => {
    it('should only include any records that have been flagged on the configured column when used in a .eager() function call', () => {
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
          };
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
            .eager('testObjects(deleted)')
            .first();
        })
        .then((result) => {
          expect(result.testObjects.length).to.equal(1, 'eager returns not filtered properly');
          expect(result.testObjects[0].id).to.equal(1, 'wrong result returned');
        });
    });
  });

  describe('models with different columnNames', () => {
    it('should use the correct columnName for each model', () => {
      const TestObject = getModel({ columnName: 'inactive' });

      // define the relationship to the TestObjects table
      const RelatedObject = class RelatedObject extends sutFactory()(Model) {
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
          };
        }
      };

      return TestObject.query(knex)
        .where('id', 1)
        .del()
        .then(() => {
          return RelatedObject.query(knex)
            .whereNotDeleted()
            .eager('testObjects(notDeleted)');
        })
        .then((result) => {
          expect(result[0].deleted).to.equal(0, 'deleted row included in base result');
          expect(result[0].testObjects.length).to.equal(1, 'wrong number of eager relations loaded');
          expect(result[0].testObjects[0].inactive).to.equal(0, 'deleted row included in eager relations');
        });
    });
  });
});
