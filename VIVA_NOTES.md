# RetailPlus viva notes

## One-minute explanation

RetailPlus takes a retail CSV or seeded synthetic transactions, saves raw input unchanged, cleans/profiles data with traceable changes, and saves immutable CSV/Parquet versions. Mapped fields drive sales analytics, rule-based insights, evaluated churn prediction and segmentation. FastAPI exposes workspace-scoped results to React. PostgreSQL holds metadata, jobs, models and customer JSONB documents. An optional isolated Spark worker demonstrates processing APIs locally.

## Pipeline and quality

**Raw versus clean?** Raw is the exact source for replay/audit. Clean is a versioned interpretation after normalization, unambiguous key fills, logged statistical imputations and exact duplicate removal. Invalid transactions are retained and flagged.

**Why not fill every blank?** Unknown facts should not be invented. IDs remain strings. Key fills require exactly one known value. Median/mode fills are explicit estimates, not recovered truth. Financial median fills are excluded from KPIs; columns above 60% missing are flagged.

**Quality score?** Completeness = nonmissing source cells / source cells. Uniqueness = 1 − duplicates / rows. Validity = 1 − invalid transaction rows / rows. The score is the mean of those percentages. Internal metadata is excluded from completeness/uniqueness. High quality under these rules does not prove semantic correctness.

**Why Parquet?** Columnar storage supports compression, schemas and efficient analytical column reads. CSV is convenient interchange but loses types/formatting. Local Parquet files are a lake, not an ACID lakehouse table system.

**What happens on edit?** A dataset lock serializes writes. A new CSV/Parquet revision and provenance record are created; raw data stays unchanged. Models and customer output are invalidated so they cannot silently describe another revision.

## Analytics

**Revenue?** Sum valid completed line amounts: mapped amount, or price × quantity. Cancelled/returned lines and median financial imputations are excluded.

**AOV?** Completed revenue divided by distinct completed orders. Without order ID, rows are treated as orders and the limitation is explicit.

**Cancellation rate?** Distinct cancelled order IDs / all valid distinct orders × 100. Mixed line statuses require a more detailed order policy.

**Filters?** Date, category, geography, store and customer filters apply to one mapped transaction frame before all KPIs/charts/rules. Exports receive the same filters.

**Are cancellation reasons causal?** No. Group cancellation rates are associations. Sales z-scores flag anomalies; category comparisons use adjacent 30-day windows; high-value customers use the spending decile. Inventory is synthetic and labeled simulated.

## Churn and segmentation

**Define churn.** No valid completed purchase in the 90 days after a historical cutoff. Cutoff = latest valid date minus 90 days. Features use dates at/before cutoff; outcomes use dates after it. At least 180 days of history are required.

**Features?** Recency, completed distinct-order frequency, monetary value, AOV, cancellation rate, tenure and category diversity. IDs and later purchase activity are not features.

**Leakage?** Using information unavailable at prediction time. Feature/label boundaries prevent temporal overlap. Scaling and fitting use only training customers; test customers remain held out. A single historical cutoff still needs future validation before production use.

**Why logistic regression?** A simple probability baseline with interpretable standardized coefficients. Coefficients describe the fitted association, not causality.

**Why random forest?** Captures nonlinear interactions. Impurity importance helps inspect the fitted model but can favor continuous/high-cardinality features.

**Metrics?** Stratified train/test split holds out 25% with seed 42. Both models use the same holdout. Accuracy = (TP+TN)/N; precision = TP/(TP+FP); recall = TP/(TP+FN); F1 = 2TP/(2TP+FP+FN). Churn is the positive class. Undefined precision/recall becomes zero. Confusion matrix rows are actual and columns predicted in [retained, churned] order. Tests recompute metrics from the matrix.

**Are risk scores holdout predictions?** Current customer features are scored with the training-only fitted forest; these are current probabilities. Metrics remain historical holdout measurements. Low <0.33, Medium 0.33–0.66, High >0.66. Thresholds are demo policy, not calibrated business guarantees.

**Why KMeans as well as churn?** KMeans is unsupervised RFM grouping; churn is supervised prediction of a defined outcome. Four clusters of scaled log recency/frequency/monetary features are ranked and named Champions, Loyal, At Risk and Lost. Segment names are descriptive, separate from predicted risk.

**Unsuitable custom data?** Mapping and sufficiency checks explain missing fields/history/classes. Date/amount analytics can still run without churn eligibility. Model metrics are never invented.

## Big-data syllabus

**Real Hadoop/Kafka?** No. They are conceptual explanations. Live arrivals are explicitly simulated. Normal app processing uses pandas, not a distributed cluster.

**Real Spark demonstration?** A local session reads cleaned Parquet. DataFrame groupBy/sum, an RDD map/reduceByKey and Spark SQL calculate category revenue for valid completed lines. Map emits (category, amount), shuffle groups keys, reduce sums. The page reports actual output and timing only after successful execution.

**Driver, executors, DAG?** The driver coordinates; executors run partition tasks. Transformations build a DAG; actions such as count/collect trigger execution. The demo uses local[2], not a multi-machine cluster.

**HDFS/YARN?** HDFS replicates file blocks; the NameNode tracks metadata and DataNodes store blocks. YARN schedules cluster resources. Neither runs here.

**Kafka partitions/offsets?** Topics have partitions, each an ordered log. Producers append; consumers track offsets; consumer groups share partitions. Browser replay has no broker, persisted offsets or delivery guarantees.

**Why PostgreSQL instead of MongoDB?** It already provides relational integrity and JSONB nested customer documents with indexed queries. One database meets this scope. No MongoDB fallback is required.

**CAP?** During a network partition a distributed system cannot guarantee both linearizable consistency and availability for every request. It is a partition-behavior theorem, not a claim that local databases permanently choose only two properties.

**Batch vs stream?** Batch processes bounded snapshots. Streams process ongoing arrivals and need state, offsets, event-time and recovery policies. Implemented pipelines are batch; the live page demonstrates arrivals visually.

**Cloud equivalents?** S3 / ADLS / Cloud Storage for lakes; EMR / Databricks / Dataproc for Spark; MSK / Event Hubs / Pub/Sub for event systems (not identical); RDS / Azure PostgreSQL / Cloud SQL for relational storage. These are conceptual analogues, not deployed integrations.

## Honest limits

**Next-month product outlook?** A simple planning baseline, not an evaluated ML forecast: average units in the three calendar months preceding the final observation month. Zero-sale months are included; the partial final month is excluded. The output month is the month after the final observation month, so dates are relative to dataset history, not today's clock. Direction compares that baseline with the most recent baseline month's units. Product mapping and sufficient filtered history are required.

**Direct customer labels?** Likely to return, Check in soon and May not return are UI aliases for Low/Medium/High churn risk. They do not add a new model or promise a purchase. Probability, scoring date and limitations remain available in the profile.

100K rows / 50 MB CSV, no 500K promise. Local files need backup alongside PostgreSQL. Single-process background jobs require retry after interruption. Single-cutoff evaluation, synthetic data and ranked cluster naming are classroom limitations. Production streaming, causal cancellation explanations, currency/refund accounting and optional Assistant remain unimplemented. Status distinguishes implemented, simulated, conceptual, unavailable and planned features.

## Business-facing product planning

Predictions separates product planning, customer retention and churn evaluation. Demand planning uses per-SKU monthly units; ABC analysis prioritizes products by revenue contribution. Revenue is not profit because COGS is not mapped. Replenishment is a user-input coverage calculator, not inferred stock or an EOQ model. MAE, WAPE and signed bias measure rolling historical unit errors at the actual two-month planning horizon. At least three checks are required for choosing a baseline; they are not independent prospective validation. No seasonality, promotion effects, margin or guaranteed sales are claimed.

Dataset deletion is workspace scoped and removes linked PostgreSQL records and UUID-owned local files. Files are staged with a recovery manifest and ordinary failures roll back. A running pipeline prevents deletion. The UI requires explicit confirmation of a named dataset; external source originals are retained.
