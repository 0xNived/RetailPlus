"""Optional isolated Spark worker. Standard app calculations remain in pandas."""
import json
import os
from pathlib import Path
import sys
from time import perf_counter


def run(parquet, mapping):
    from pyspark.sql import SparkSession, functions as F
    started = perf_counter()
    spark = SparkSession.builder.master("local[2]").appName("RetailPlus viva demo").config("spark.ui.enabled", "false").config("spark.sql.shuffle.partitions", "2").getOrCreate()
    spark.sparkContext.setLogLevel("ERROR")
    try:
        raw = spark.read.parquet(parquet)

        def column(field, default=None):
            name = mapping.get(field)
            return F.col("`" + name.replace("`", "``") + "`") if name else F.lit(default)

        amount = column("amount").cast("double") if mapping.get("amount") else column("price").cast("double") * column("quantity", 1).cast("double")
        valid = amount.isNotNull() & (amount >= 0) & (F.to_date(column("order_date")) <= F.current_date())
        if mapping.get("quantity"):
            valid = valid & (column("quantity").cast("double") > 0)
        if mapping.get("price"):
            valid = valid & (column("price").cast("double") >= 0)
        if mapping.get("status"):
            valid = valid & (F.lower(column("status")) == "completed")
        if "_imputed_fields" in raw.columns:
            for field in ("amount", "price", "quantity"):
                if mapping.get(field):
                    valid = valid & ~F.array_contains(F.split(F.coalesce(F.col("_imputed_fields"), F.lit("")), "\\|"), mapping[field])
        data = raw.filter(valid).select(F.coalesce(column("category"), F.lit("Unknown")).alias("category"), amount.alias("amount")).cache()
        count = data.count()
        dataframe = [{"category": row.category, "revenue": float(row.revenue)} for row in data.groupBy("category").agg(F.sum("amount").alias("revenue")).orderBy("category").collect()]
        rdd = [{"category": key, "revenue": float(value)} for key, value in sorted(data.rdd.map(lambda row: (row.category, row.amount)).reduceByKey(lambda a, b: a + b).collect())]
        data.createOrReplaceTempView("retail_sales")
        sql = [{"category": row.category, "revenue": float(row.revenue)} for row in spark.sql("SELECT category, SUM(amount) AS revenue FROM retail_sales GROUP BY category ORDER BY category").collect()]
        return {"seconds": round(perf_counter() - started, 3), "dataframe": dataframe, "rdd": rdd, "sql": sql, "mapped_rows": count}
    finally:
        spark.stop()


if __name__ == "__main__":
    config = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    os.environ["PYSPARK_PYTHON"] = sys.executable
    result = run(config["parquet"], config["mapping"])
    Path(sys.argv[2]).write_text(json.dumps(result), encoding="utf-8")
