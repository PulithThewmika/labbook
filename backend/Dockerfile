# Build with the same Ballerina version used locally and in CI, then run the jar.
FROM ballerina/ballerina:2201.14.2 AS build
COPY --chown=ballerina:troupe . /home/ballerina/src
WORKDIR /home/ballerina/src
RUN bal build

FROM ballerina/ballerina:2201.14.2
COPY --from=build /home/ballerina/src/target/bin/labbook_api.jar /home/ballerina/app.jar
EXPOSE 8080
CMD ["java", "-jar", "/home/ballerina/app.jar"]
