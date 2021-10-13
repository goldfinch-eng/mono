const InfoIcon = ({width = 18, height = 18, color = "#C4BeB7", className = ""}) => (
  <svg
    className={className}
    width={width}
    height={height}
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M9 16.481A7.481 7.481 0 1 0 9 1.52 7.481 7.481 0 0 0 9 16.48ZM9 18A9 9 0 1 0 9 0a9 9 0 0 0 0 18Z"
      fill={color}
    />
    <path
      d="m9.956 8.222.074-1.528h-.514l-2.13.735v.352l1.101.514v4.358c0 .675-.499.749-1.175.837v.572h3.819v-.572c-.675-.088-1.175-.162-1.175-.837V8.222ZM8.18 4.403c0 .573.455 1.028 1.028 1.028s1.028-.455 1.028-1.028-.455-1.028-1.028-1.028S8.18 3.83 8.18 4.403Z"
      fill={color}
    />
  </svg>
)

export default InfoIcon
