import { useEffect, useState } from "react";
import { Card } from "./components";
import { formatNumber as number } from "../retailApi";

type Model = {
  definition: string;
  cutoff: string;
  scoring_date: string;
  train_customers: number;
  test_customers: number;
  revision: number;
  limitation: string;
  models: {
    name: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    confusion_matrix: number[][];
    importance: { feature: string; value: number }[];
  }[];
};
import { retailRequest } from "../retailApi";
const featureNames: Record<string, string> = {
  recency: "Days since last purchase",
  frequency: "Completed order frequency",
  monetary: "Historical customer spend",
  average_order_value: "Average order value",
  cancellation_rate: "Cancellation rate",
  tenure: "Customer tenure",
  category_diversity: "Category diversity",
};

export default function PredictionEvaluation({
  token,
  id,
}: {
  token: string;
  id: string;
}) {
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    retailRequest<Model>(token, `/retail/model?dataset_id=${id}`)
      .then((m) => {
        if (live) setModel(m);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [token, id]);
  if (error)
    return (
      <p className="csv-error" role="alert">
        {error}
      </p>
    );
  if (!model) return <p role="status">Reading evaluated models…</p>;
  return (
    <>
      <div className="rp-plan-heading">
        <div>
          <h2>Customer retention model evaluation</h2>
          <p>{model.definition}</p>
          <p>
            Training cutoff {model.cutoff.slice(0, 10)} ·{" "}
            {number(model.train_customers)} training /{" "}
            {number(model.test_customers)} holdout customers · Scored{" "}
            {model.scoring_date.slice(0, 10)} · revision {model.revision}
          </p>
        </div>
      </div>
      <div className="rp-plan-detail-grid">
        {model.models.map((m) => (
          <Card
            key={m.name}
            title={m.name}
            subtitle="Historical holdout performance; churn is the positive class."
          >
            <div className="rp-eval-metrics">
              {(["accuracy", "precision", "recall", "f1"] as const).map((k) => (
                <div key={k}>
                  <span>{k === "f1" ? "F1 score" : k}</span>
                  <strong>{number(m[k] * 100, 1)}%</strong>
                </div>
              ))}
            </div>
            <dl className="rp-eval-definitions">
              <dt>Precision</dt>
              <dd>
                Of customers flagged as churned, how many actually churned.
              </dd>
              <dt>Recall</dt>
              <dd>Of customers who churned, how many the model found.</dd>
              <dt>F1 score</dt>
              <dd>
                Balances precision and recall; accuracy alone can hide missed
                churn.
              </dd>
            </dl>
            <div className="rp-data-scroll">
              <table className="rp-table">
                <caption>Confusion matrix · counts of customers</caption>
                <thead>
                  <tr>
                    <th>Actual / predicted</th>
                    <th>Retained</th>
                    <th>Churned</th>
                  </tr>
                </thead>
                <tbody>
                  {m.confusion_matrix.map((row, i) => (
                    <tr key={i}>
                      <th>{i === 0 ? "Retained" : "Churned"}</th>
                      {row.map((value, j) => (
                        <td key={j}>{number(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rp-feature-list">
              <h4>
                {m.name === "Random forest"
                  ? "Feature importance"
                  : "Standardized coefficients (signed)"}
              </h4>
              {m.importance.map((f) => (
                <div key={f.feature}>
                  <span>{featureNames[f.feature] || f.feature}</span>
                  <b>{number(f.value, 3)}</b>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <p className="rp-plan-note">
        {model.limitation} Feature importance describes associations, not
        causes. Product demand baselines have separate rolling error checks
        under Product planning.
      </p>
    </>
  );
}
