import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>> | undefined;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Explore the smart contracts',
    Svg: undefined,
    description: (
      <>
        Jump in by reading the <a href="/docs/reference/contracts/overview">Overview</a>.
        Check out the <a href="/docs/reference/contracts/architecture">Architecture</a> diagram
        for a graphical overview.
      </>
    ),
  },
  {
    title: 'Learn how the Protocol works',
    Svg: undefined,
    description: (
      <>
        This <a href="/docs/reference/how-the-protocol-works">walkthrough</a> explains at a high level
        how the smart contracts work together to create the Protocol's mechanics.
      </>
    ),
  },
  {
    title: 'Understand Protocol security',
    Svg: undefined,
    description: (
      <>
        Learn about the Protocol's approach to <a href="/docs/reference/pausability">pausability</a>,
        {' '}<a href="/docs/reference/upgradeability">upgradeability</a>,
        dealing with <a href="/docs/reference/flashloans">flashloans</a>, mitigating
        {' '}<a href="/docs/reference/front-running">front-running</a>, and more. Read the Protocol's
        {' '}<a href="/docs/security/audit-reports">external audit reports</a>.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        {Svg ? <Svg className={styles.featureSvg} role="img" /> : undefined}
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
