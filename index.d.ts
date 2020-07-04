declare module 'objection-soft-delete' {
  import { Model } from 'objection';

  class SDQueryBuilder<M extends Model> {
    SingleQueryBuilderType: SDQueryBuilder<M>;

    delete(): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];
    hardDelete(): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];
    undelete(): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];
    whereDeleted(): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];
    whereNotDeleted(): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];
  }

  interface SDInstance<T extends typeof Model> {
    QueryBuilderType: SDQueryBuilder<this & T['prototype']>;
  }

  interface SDStatic<T extends typeof Model> {
    QueryBuilder: typeof SDQueryBuilder;
    isSoftDelete: boolean;
    namedFilters(): object;
    
    new(): SDInstance<T> & T['prototype'];
  }

  export default function softDelete<T extends typeof Model>(options?: Partial<{
      columnName: string;
      deletedValue: true | number;
      notDeletedValue: false | null
    }>): (model: T) => SDStatic<T> & Omit<T, 'new'> & T['prototype'];
}
